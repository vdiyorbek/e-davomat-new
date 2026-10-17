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
import { UpdateWeeklyScheduleDto } from './dto/update-weekly-schedule.dto';

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

  async update(
    id: number,
    dto: UpdateWeeklyScheduleDto,
    user: AuthenticatedUser,
  ) {
    const today = new Date(Date.now() + 5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const repo = manager.getRepository(AttendanceWeeklySchedule);

      const current = await repo.findOneBy({ id });

      if (!current) {
        throw new NotFoundException('Haftalik jadval topilmadi');
      }

      // Shu maktabga yozish huquqini tekshiramiz.
      // Maktab qatorini bloklash parallel o'zgarishlarni
      // ketma-ket bajarishga yordam beradi.
      await this.checkSchoolAccess(current.schoolId, user, manager, true);

      const schedule = await repo.findOneBy({ id });

      if (!schedule) {
        throw new NotFoundException('Haftalik jadval topilmadi');
      }

      const newStart = dto.effectiveFrom ?? schedule.effectiveFrom;

      if (newStart <= today) {
        throw new BadRequestException(
          'O‘tgan yoki bugungi sanadan boshlab jadvalni o‘zgartirib bo‘lmaydi',
        );
      }

      this.validateYear(schedule.academicYear, newStart);

      if (newStart < schedule.effectiveFrom) {
        throw new BadRequestException(
          'Yangi sana mavjud jadval boshlanishidan oldin bo‘lmasligi kerak',
        );
      }

      if (schedule.effectiveTo !== null && newStart > schedule.effectiveTo) {
        throw new BadRequestException(
          'Yangi sana jadvalning amal qilish davridan tashqarida',
        );
      }

      // Jadval hali boshlanmagan bo'lsa,
      // boshlanish sanasini o'zgartirmasdan tahrirlaymiz.
      if (newStart === schedule.effectiveFrom) {
        schedule.workingDaysMask = dto.workingDaysMask;

        const updated = await repo.save(schedule);

        return {
          action: 'UPDATED',
          schedule: updated,
        };
      }

      // Sana oralig'ining yangi qismi boshqa bir xil
      // guruh jadvali bilan to'qnashmasligini tekshiramiz.
      const candidates = await repo
        .createQueryBuilder('s')
        .where('s.schoolId = :schoolId', {
          schoolId: schedule.schoolId,
        })
        .andWhere('s.id != :id', { id })
        .andWhere('s.academicYear = :academicYear', {
          academicYear: schedule.academicYear,
        })
        .andWhere('s.membershipType = :membershipType', {
          membershipType: schedule.membershipType,
        })
        .andWhere('s.effectiveFrom <= :endDate', {
          endDate: schedule.effectiveTo ?? '9999-12-31',
        })
        .andWhere('(s.effectiveTo IS NULL OR s.effectiveTo >= :startDate)', {
          startDate: newStart,
        })
        .getMany();

      const conflict = candidates.some((other) => {
        if (schedule.membershipType === MembershipType.TEACHER) {
          return true;
        }

        if (schedule.classId !== null || other.classId !== null) {
          return (
            schedule.classId !== null && schedule.classId === other.classId
          );
        }

        return (
          schedule.gradeFrom !== null &&
          schedule.gradeTo !== null &&
          other.gradeFrom !== null &&
          other.gradeTo !== null &&
          schedule.gradeFrom <= other.gradeTo &&
          schedule.gradeTo >= other.gradeFrom
        );
      });

      if (conflict) {
        throw new ConflictException(
          'Ushbu sana uchun boshqa haftalik jadval mavjud',
        );
      }

      // Eski jadval yangi qoida boshlanishidan
      // bir kun oldin tugaydi.
      const previousDay = new Date(
        Date.parse(`${newStart}T00:00:00Z`) - 86400000,
      )
        .toISOString()
        .slice(0, 10);

      const originalEnd = schedule.effectiveTo;

      schedule.effectiveTo = previousDay;

      await repo.save(schedule);

      // Yangi tartibni alohida yozuv sifatida saqlaymiz.
      const nextSchedule = repo.create({
        schoolId: schedule.schoolId,
        academicYear: schedule.academicYear,
        membershipType: schedule.membershipType,
        gradeFrom: schedule.gradeFrom,
        gradeTo: schedule.gradeTo,
        classId: schedule.classId,
        workingDaysMask: dto.workingDaysMask,
        effectiveFrom: newStart,
        effectiveTo: originalEnd,
        createdByUserId: user.id,
      });

      const saved = await repo.save(nextSchedule);

      return {
        action: 'REVISED',
        previousSchedule: schedule,
        newSchedule: saved,
      };
    });
  }
}
