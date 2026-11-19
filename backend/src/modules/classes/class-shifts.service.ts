import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { SchoolClass } from './school-class.entity';
import { SchoolClassShift } from './school-class-shift.entity';
import { SchoolShiftsService } from './school-shifts.service';
import { assertSchoolAccess, todayInTashkent } from './school-access';
import {
  AssignClassShiftDto,
  AssignClassShiftsDto,
} from './dto/assign-class-shifts.dto';

export interface CurrentClassShift {
  code: number;
  name: string;
  startTime: string;
  endTime: string;
  startDate: string;
}

/**
 * Sinf smenasi tarix ko‘rinishida saqlanadi: [startDate, endDate).
 * Shu sababli o‘tgan kunlar davomati eski smena bo‘yicha qoladi.
 */
export function applyAssignment(
  history: SchoolClassShift[],
  classId: number,
  shiftId: number,
  startDate: string,
): { save: SchoolClassShift[]; create: Partial<SchoolClassShift> | null } {
  const sameStart = history.find((item) => item.startDate === startDate);

  if (sameStart) {
    if (sameStart.shiftId === shiftId) return { save: [], create: null };
    sameStart.shiftId = shiftId;
    return { save: [sameStart], create: null };
  }

  const previous = [...history]
    .reverse()
    .find((item) => item.startDate < startDate);
  const next = history.find((item) => item.startDate > startDate);

  const previousCovers =
    previous && (previous.endDate === null || previous.endDate > startDate);

  // Sinf shu sanada allaqachon shu smenada — tarixni bo‘lib tashlamaymiz.
  if (previousCovers && previous.shiftId === shiftId) {
    return { save: [], create: null };
  }

  const save: SchoolClassShift[] = [];

  if (previousCovers) {
    previous.endDate = startDate;
    save.push(previous);
  }

  return {
    save,
    create: {
      classId,
      shiftId,
      startDate,
      endDate: next?.startDate ?? null,
    },
  };
}

@Injectable()
export class ClassShiftsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly schoolShifts: SchoolShiftsService,
  ) {}

  private resolveStartDate(value: string | undefined): string {
    const today = todayInTashkent();
    const startDate = value ?? today;

    if (startDate < today) {
      throw new BadRequestException(
        'O‘tgan sanadan smena belgilash mumkin emas',
      );
    }

    return startDate;
  }

  private async loadClasses(
    manager: EntityManager,
    classIds: number[],
    user: AuthenticatedUser,
    lock: boolean,
  ): Promise<SchoolClass[]> {
    const query = manager
      .getRepository(SchoolClass)
      .createQueryBuilder('schoolClass')
      .innerJoinAndSelect('schoolClass.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .where('schoolClass.id IN (:...classIds)', { classIds })
      .orderBy('schoolClass.id', 'ASC');

    if (lock) {
      // Bir sinfga bir vaqtda ikki xil smena yozilmasin. Faqat sinf
      // qatorlari qulflanadi (maktab/tuman emas), tartib — deadlock'siz.
      await manager.query(
        `SELECT id FROM school_classes WHERE id IN (${classIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
        classIds,
      );
    }

    const classes = await query.getMany();

    if (classes.length !== classIds.length) {
      throw new NotFoundException('Ba’zi sinflar topilmadi');
    }

    for (const schoolClass of classes) {
      assertSchoolAccess(user, schoolClass.school);
    }

    return classes;
  }

  async history(classId: number, user: AuthenticatedUser) {
    await this.loadClasses(this.dataSource.manager, [classId], user, false);

    return this.dataSource.getRepository(SchoolClassShift).find({
      where: { classId },
      relations: { shift: true },
      order: { startDate: 'ASC', id: 'ASC' },
    });
  }

  async assign(
    classId: number,
    dto: AssignClassShiftDto,
    user: AuthenticatedUser,
  ) {
    await this.assignMany({ ...dto, classIds: [classId] }, user);
    return this.history(classId, user);
  }

  async assignMany(dto: AssignClassShiftsDto, user: AuthenticatedUser) {
    const startDate = this.resolveStartDate(dto.startDate);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const classes = await this.loadClasses(manager, dto.classIds, user, true);

      const shiftIdBySchool = new Map<number, number>();

      for (const schoolId of new Set(classes.map((item) => item.schoolId))) {
        const shift = await this.schoolShifts.ensureShift(
          manager,
          schoolId,
          dto.shiftCode,
        );
        shiftIdBySchool.set(schoolId, shift.id);
      }

      const repository = manager.getRepository(SchoolClassShift);

      // Barcha sinflar tarixi bitta so‘rovda.
      const rows = await repository.find({
        where: { classId: In(dto.classIds) },
        order: { startDate: 'ASC', id: 'ASC' },
      });

      const toSave: SchoolClassShift[] = [];
      const toCreate: Partial<SchoolClassShift>[] = [];

      for (const schoolClass of classes) {
        const result = applyAssignment(
          rows.filter((row) => row.classId === schoolClass.id),
          schoolClass.id,
          shiftIdBySchool.get(schoolClass.schoolId)!,
          startDate,
        );

        toSave.push(...result.save);
        if (result.create) toCreate.push(result.create);
      }

      // Avval eski intervallar yopiladi, keyin yangilari qo‘shiladi.
      if (toSave.length > 0) await repository.save(toSave);
      if (toCreate.length > 0) await repository.insert(toCreate);

      return {
        shiftCode: dto.shiftCode,
        startDate,
        requested: classes.length,
        changed: new Set([
          ...toSave.map((row) => row.classId),
          ...toCreate.map((row) => row.classId!),
        ]).size,
      };
    });
  }

  /** Berilgan sanadagi sinflar smenasi — bitta so‘rovda. */
  async currentShifts(
    classIds: number[],
    date = todayInTashkent(),
  ): Promise<Map<number, CurrentClassShift>> {
    const result = new Map<number, CurrentClassShift>();

    if (classIds.length === 0) return result;

    const rows = await this.dataSource
      .getRepository(SchoolClassShift)
      .createQueryBuilder('classShift')
      .innerJoinAndSelect('classShift.shift', 'shift')
      .where('classShift.classId IN (:...classIds)', { classIds })
      .andWhere('classShift.startDate <= :date', { date })
      .andWhere('(classShift.endDate IS NULL OR classShift.endDate > :date)', {
        date,
      })
      .getMany();

    for (const row of rows) {
      result.set(row.classId, {
        code: row.shift.code,
        name: row.shift.name,
        startTime: row.shift.startTime.slice(0, 5),
        endTime: row.shift.endTime.slice(0, 5),
        startDate: row.startDate,
      });
    }

    return result;
  }
}
