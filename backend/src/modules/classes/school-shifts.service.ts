import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { School } from '../schools/school.entity';
import { SchoolShift } from './school-shift.entity';
import { assertSchoolAccess } from './school-access';
import { UpsertSchoolShiftsDto } from './dto/upsert-school-shifts.dto';

/** Maktab hali smena vaqtini kiritmagan bo‘lsa ishlatiladigan qiymatlar. */
export const DEFAULT_SHIFTS = [
  { code: 1, name: '1-smena', startTime: '08:00', endTime: '13:00' },
  { code: 2, name: '2-smena', startTime: '13:30', endTime: '18:30' },
] as const;

export interface SchoolShiftView {
  code: number;
  name: string;
  startTime: string;
  endTime: string;
  configured: boolean;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

@Injectable()
export class SchoolShiftsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async loadSchool(
    manager: EntityManager,
    schoolId: number,
    user: AuthenticatedUser,
  ): Promise<School> {
    const school = await manager.findOne(School, {
      where: { id: schoolId },
      relations: { district: true },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    assertSchoolAccess(user, school);
    return school;
  }

  async list(
    schoolId: number,
    user: AuthenticatedUser,
  ): Promise<SchoolShiftView[]> {
    await this.loadSchool(this.dataSource.manager, schoolId, user);

    const rows = await this.dataSource
      .getRepository(SchoolShift)
      .find({ where: { schoolId, isActive: true } });

    return DEFAULT_SHIFTS.map((fallback) => {
      const row = rows.find((item) => item.code === fallback.code);

      return row
        ? {
            code: row.code,
            name: row.name,
            startTime: hhmm(row.startTime),
            endTime: hhmm(row.endTime),
            configured: true,
          }
        : { ...fallback, configured: false };
    });
  }

  async upsert(
    schoolId: number,
    dto: UpsertSchoolShiftsDto,
    user: AuthenticatedUser,
  ): Promise<SchoolShiftView[]> {
    const codes = dto.shifts.map((item) => item.code);

    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException(
        'Har bir smena bir marta yuborilishi kerak',
      );
    }

    for (const shift of dto.shifts) {
      if (shift.startTime >= shift.endTime) {
        throw new BadRequestException(
          `${shift.name}: boshlanish vaqti tugashdan oldin bo‘lishi kerak`,
        );
      }
    }

    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await this.loadSchool(manager, schoolId, user);

      for (const shift of dto.shifts) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(SchoolShift)
          .values({
            schoolId,
            code: shift.code,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            isActive: true,
          })
          .orUpdate(
            ['name', 'startTime', 'endTime', 'isActive'],
            ['schoolId', 'code'],
          )
          .execute();
      }
    });

    return this.list(schoolId, user);
  }

  /**
   * Tayinlash paytida smena yozuvi hali yo‘q bo‘lsa, standart vaqt bilan
   * yaratadi. Admin vaqtni keyinroq o‘zgartirishi mumkin.
   */
  async ensureShift(
    manager: EntityManager,
    schoolId: number,
    code: number,
  ): Promise<SchoolShift> {
    const repository = manager.getRepository(SchoolShift);
    const existing = await repository.findOneBy({ schoolId, code });

    if (existing) {
      if (!existing.isActive) {
        throw new BadRequestException(
          `Ushbu maktabda ${code}-smena o‘chirilgan`,
        );
      }
      return existing;
    }

    const fallback = DEFAULT_SHIFTS.find((item) => item.code === code);

    if (!fallback) {
      throw new BadRequestException('Smena 1 yoki 2 bo‘lishi kerak');
    }

    await manager
      .createQueryBuilder()
      .insert()
      .into(SchoolShift)
      .values({ schoolId, ...fallback, isActive: true })
      .orIgnore()
      .execute();

    return repository.findOneByOrFail({ schoolId, code });
  }
}
