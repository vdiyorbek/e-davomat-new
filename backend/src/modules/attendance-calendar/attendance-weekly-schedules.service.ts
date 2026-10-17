import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { School } from '../schools/school.entity';
import { District } from '../districts/district.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { MembershipType } from '../school-memberships/school-membership.entity';

import { AttendanceWeeklySchedule } from './attendance-weekly-schedule.entity';
import { CreateWeeklyScheduleDto } from './dto/create-weekly-schedule.dto';
import { GetWeeklySchedulesDto } from './dto/get-weekly-schedules.dto';

@Injectable()
export class AttendanceWeeklySchedulesService {
  constructor(private readonly dataSource: DataSource) {}

  private async checkSchoolAccess(
    schoolId: number,
    user: AuthenticatedUser,
    manager: EntityManager,
    lock = false,
  ): Promise<School> {
    const builder = manager
      .getRepository(School)
      .createQueryBuilder('school')
      .where('school.id = :schoolId', { schoolId });

    if (lock) {
      builder.setLock('pessimistic_write');
    }

    const school = await builder.getOne();

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const district = await manager.findOneBy(District, {
      id: school.districtId,
    });

    if (!district) {
      throw new NotFoundException('Tuman topilmadi');
    }

    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.REGION_ADMIN &&
        user.regionId === district.regionId) ||
      (user.role === UserRole.DISTRICT_ADMIN &&
        user.districtId === school.districtId) ||
      (user.role === UserRole.SCHOOL_ADMIN && user.schoolId === school.id);

    if (!allowed) {
      throw new ForbiddenException(
        'Ushbu maktab jadvalini boshqarishga ruxsat yo‘q',
      );
    }

    return school;
  }

  private validateYear(
    academicYear: string,
    effectiveFrom?: string,
    effectiveTo?: string,
  ) {
    const [from, to] = academicYear.split('-').map(Number);

    if (to !== from + 1 || from < 2000 || to > 2100) {
      throw new BadRequestException('O‘quv yili formati noto‘g‘ri');
    }

    const yearStart = `${from}-09-01`;
    const yearEnd = `${to}-08-31`;

    if (effectiveFrom) {
      if (effectiveFrom < yearStart || effectiveFrom > yearEnd) {
        throw new BadRequestException(
          'Boshlanish sanasi o‘quv yiliga mos emas',
        );
      }
    }

    if (effectiveTo) {
      if (
        effectiveTo < yearStart ||
        effectiveTo > yearEnd ||
        (effectiveFrom && effectiveTo < effectiveFrom)
      ) {
        throw new BadRequestException('Tugash sanasi noto‘g‘ri');
      }
    }
  }

  async findAll(dto: GetWeeklySchedulesDto, user: AuthenticatedUser) {
    this.validateYear(dto.academicYear);

    await this.checkSchoolAccess(dto.schoolId, user, this.dataSource.manager);

    return this.dataSource
      .getRepository(AttendanceWeeklySchedule)
      .createQueryBuilder('schedule')
      .where('schedule.schoolId = :schoolId', {
        schoolId: dto.schoolId,
      })
      .andWhere('schedule.academicYear = :academicYear', {
        academicYear: dto.academicYear,
      })
      .orderBy('schedule.effectiveFrom', 'ASC')
      .addOrderBy('schedule.id', 'ASC')
      .getMany();
  }

  async create(dto: CreateWeeklyScheduleDto, user: AuthenticatedUser) {
    this.validateYear(dto.academicYear, dto.effectiveFrom, dto.effectiveTo);

    const isStudent = dto.membershipType === MembershipType.STUDENT;

    const hasClass = dto.classId != null;
    const hasFrom = dto.gradeFrom != null;
    const hasTo = dto.gradeTo != null;

    if (isStudent) {
      if (hasClass) {
        if (hasFrom || hasTo) {
          throw new BadRequestException(
            'Sinf ID va sinf oralig‘i birga yuborilmaydi',
          );
        }
      } else {
        if (!hasFrom || !hasTo) {
          throw new BadRequestException(
            'O‘quvchilar uchun sinf oralig‘ini belgilang',
          );
        }

        if (dto.gradeFrom! > dto.gradeTo!) {
          throw new BadRequestException(
            'Boshlang‘ich sinf darajasi katta bo‘lmasligi kerak',
          );
        }
      }
    } else if (hasClass || hasFrom || hasTo) {
      throw new BadRequestException(
        'O‘qituvchilar jadvali maktab bo‘yicha belgilanadi',
      );
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Bir maktabdagi parallel yozuvlarni ketma-ket qilamiz.
      await this.checkSchoolAccess(dto.schoolId, user, manager, true);

      if (hasClass) {
        const schoolClass = await manager.findOneBy(SchoolClass, {
          id: dto.classId!,
          schoolId: dto.schoolId,
          academicYear: dto.academicYear,
        });

        if (!schoolClass) {
          throw new BadRequestException(
            'Sinf maktab yoki o‘quv yiliga mos emas',
          );
        }
      }

      const repo = manager.getRepository(AttendanceWeeklySchedule);

      const existing = await repo
        .createQueryBuilder('schedule')
        .where('schedule.schoolId = :schoolId', {
          schoolId: dto.schoolId,
        })
        .andWhere('schedule.academicYear = :academicYear', {
          academicYear: dto.academicYear,
        })
        .andWhere('schedule.membershipType = :type', {
          type: dto.membershipType,
        })
        .andWhere('schedule.effectiveFrom <= :newEnd', {
          newEnd: dto.effectiveTo ?? '9999-12-31',
        })
        .andWhere(
          '(schedule.effectiveTo IS NULL OR schedule.effectiveTo >= :newStart)',
          { newStart: dto.effectiveFrom },
        )
        .getMany();

      const conflict = existing.some((row) => {
        if (!isStudent) return true;

        // Alohida sinflar mustaqil bo‘lishi mumkin.
        if (hasClass) {
          return row.classId === dto.classId;
        }

        // Sinfga xos qoida umumiy sinf oralig‘idan
        // ustuvor bo‘lishi mumkin.
        if (row.classId != null) {
          return false;
        }

        return (
          row.gradeFrom != null &&
          row.gradeTo != null &&
          row.gradeFrom <= dto.gradeTo! &&
          row.gradeTo >= dto.gradeFrom!
        );
      });

      if (conflict) {
        throw new ConflictException(
          'Ushbu sinflar va sana oralig‘i uchun jadval mavjud',
        );
      }

      const schedule = repo.create({
        schoolId: dto.schoolId,
        academicYear: dto.academicYear,
        membershipType: dto.membershipType,
        gradeFrom: dto.gradeFrom ?? null,
        gradeTo: dto.gradeTo ?? null,
        classId: dto.classId ?? null,
        workingDaysMask: dto.workingDaysMask,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        createdByUserId: user.id,
      });

      return repo.save(schedule);
    });
  }
}
