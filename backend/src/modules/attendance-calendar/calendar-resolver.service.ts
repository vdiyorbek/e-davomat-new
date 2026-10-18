import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';

import {
  AttendanceCalendarRule,
  CalendarAppliesTo,
  CalendarScopeType,
} from './attendance-calendar-rule.entity';

import { AttendanceWeeklySchedule } from './attendance-weekly-schedule.entity';
import { GetCalendarDayStatusDto } from './dto/get-calendar-day-status.dto';

export type AttendanceCalendarState =
  'WORK_DAY' | 'DAY_OFF' | 'UNCONFIGURED' | 'CONFLICT';

export interface AttendanceCalendarTarget {
  schoolId: number;
  classId: number | null;
}

export function attendanceCalendarKey(
  schoolId: number,
  classId: number | null,
): string {
  return `${schoolId}:${classId ?? 'none'}`;
}

@Injectable()
export class CalendarResolverService {
  constructor(private readonly dataSource: DataSource) {}

  private academicYear(date: string): string {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));

    const from = month >= 9 ? year : year - 1;

    return `${from}-${from + 1}`;
  }

  private dayIndex(date: string): number {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();

    // JavaScript: yakshanba = 0
    // Bizda: dushanba = 0, yakshanba = 6
    return (day + 6) % 7;
  }

  private rulePriority(rule: AttendanceCalendarRule) {
    if (rule.scopeType === CalendarScopeType.GLOBAL && rule.isMandatory) {
      return 100;
    }

    switch (rule.scopeType) {
      case CalendarScopeType.SCHOOL:
        return rule.classId !== null ? 50 : 40;

      case CalendarScopeType.DISTRICT:
        return 30;

      case CalendarScopeType.REGION:
        return 20;

      case CalendarScopeType.GLOBAL:
        return 10;

      default:
        return 0;
    }
  }

  async resolve(dto: GetCalendarDayStatusDto, actor: AuthenticatedUser) {
    const school = await this.dataSource.getRepository(School).findOne({
      where: { id: dto.schoolId },
      relations: { district: true },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const permitted =
      actor.role === UserRole.SUPER_ADMIN ||
      (actor.role === UserRole.REGION_ADMIN &&
        actor.regionId === school.district.regionId) ||
      (actor.role === UserRole.DISTRICT_ADMIN &&
        actor.districtId === school.districtId) ||
      (actor.role === UserRole.SCHOOL_ADMIN && actor.schoolId === school.id);

    if (!permitted) {
      throw new ForbiddenException(
        'Ushbu maktab kalendarini ko‘rishga ruxsat yo‘q',
      );
    }

    const isStudent = dto.membershipType === MembershipType.STUDENT;

    if (isStudent && dto.classId == null) {
      throw new BadRequestException('O‘quvchilar uchun classId kerak');
    }

    if (!isStudent && dto.classId != null) {
      throw new BadRequestException('O‘qituvchilar uchun classId yuborilmaydi');
    }

    const academicYear = this.academicYear(dto.date);
    let schoolClass: SchoolClass | null = null;

    if (isStudent) {
      schoolClass = await this.dataSource.getRepository(SchoolClass).findOneBy({
        id: dto.classId!,
        schoolId: school.id,
        academicYear,
      });

      if (!schoolClass) {
        throw new NotFoundException('Ushbu o‘quv yilida sinf topilmadi');
      }
    }

    const resultBase = {
      schoolId: school.id,
      date: dto.date,
      academicYear,
      membershipType: dto.membershipType,
      classId: schoolClass?.id ?? null,
      gradeLevel: schoolClass?.gradeLevel ?? null,
    };

    // 1. Bayram, ta'til va maxsus ish kunlari.
    const specialRules = await this.dataSource
      .getRepository(AttendanceCalendarRule)
      .createQueryBuilder('rule')
      .where('rule.isActive = :active', { active: true })
      .andWhere('rule.startDate <= :date', {
        date: dto.date,
      })
      .andWhere('rule.endDate >= :date', {
        date: dto.date,
      })
      .andWhere('(rule.appliesTo = :audience OR rule.appliesTo = :both)', {
        audience: isStudent
          ? CalendarAppliesTo.STUDENT
          : CalendarAppliesTo.TEACHER,
        both: CalendarAppliesTo.BOTH,
      })
      .getMany();

    const applicableRules = specialRules
      .filter((rule) => {
        switch (rule.scopeType) {
          case CalendarScopeType.GLOBAL:
            return true;

          case CalendarScopeType.REGION:
            return rule.regionId === school.district.regionId;

          case CalendarScopeType.DISTRICT:
            return rule.districtId === school.districtId;

          case CalendarScopeType.SCHOOL:
            return (
              rule.schoolId === school.id &&
              (rule.classId === null || rule.classId === schoolClass?.id)
            );

          default:
            return false;
        }
      })
      .sort(
        (a, b) => this.rulePriority(b) - this.rulePriority(a) || a.id - b.id,
      );

    if (applicableRules.length > 0) {
      const first = applicableRules[0];

      const samePriority = applicableRules.filter(
        (rule) => this.rulePriority(rule) === this.rulePriority(first),
      );

      const dayTypes = new Set(samePriority.map((rule) => rule.dayType));

      if (dayTypes.size > 1) {
        return {
          ...resultBase,
          status: 'CONFLICT',
          source: 'SPECIAL_RULE',
          message: 'Bir xil darajadagi kalendar qoidalari zid',
          conflictingRuleIds: samePriority.map((rule) => rule.id),
        };
      }

      return {
        ...resultBase,
        status: first.dayType,
        source: 'SPECIAL_RULE',
        ruleId: first.id,
        reason: first.reason,
        isMandatory: first.isMandatory,
      };
    }

    // 2. Maxsus qoida bo'lmasa haftalik rejaga qaraymiz.
    const schedules = await this.dataSource
      .getRepository(AttendanceWeeklySchedule)
      .createQueryBuilder('schedule')
      .where('schedule.schoolId = :schoolId', {
        schoolId: school.id,
      })
      .andWhere('schedule.academicYear = :academicYear', { academicYear })
      .andWhere('schedule.membershipType = :membershipType', {
        membershipType: dto.membershipType,
      })
      .andWhere('schedule.effectiveFrom <= :date', {
        date: dto.date,
      })
      .andWhere(
        '(schedule.effectiveTo IS NULL OR schedule.effectiveTo >= :date)',
        { date: dto.date },
      )
      .getMany();

    const applicableSchedules = schedules
      .filter((schedule) => {
        if (!isStudent) {
          return (
            schedule.classId === null &&
            schedule.gradeFrom === null &&
            schedule.gradeTo === null
          );
        }

        if (schedule.classId !== null) {
          return schedule.classId === schoolClass?.id;
        }

        const grade = schoolClass?.gradeLevel;

        return (
          grade != null &&
          schedule.gradeFrom != null &&
          schedule.gradeTo != null &&
          grade >= schedule.gradeFrom &&
          grade <= schedule.gradeTo
        );
      })
      .sort(
        (a, b) =>
          Number(b.classId !== null) - Number(a.classId !== null) ||
          a.id - b.id,
      );

    if (applicableSchedules.length === 0) {
      return {
        ...resultBase,
        status: 'UNCONFIGURED',
        source: 'NONE',
        message: 'Ushbu kun uchun haftalik reja topilmadi',
      };
    }

    const firstSchedule = applicableSchedules[0];

    const samePrioritySchedules = applicableSchedules.filter(
      (schedule) =>
        (schedule.classId !== null) === (firstSchedule.classId !== null),
    );

    if (
      samePrioritySchedules.some((schedule) => schedule.id !== firstSchedule.id)
    ) {
      return {
        ...resultBase,
        status: 'CONFLICT',
        source: 'WEEKLY_SCHEDULE',
        message: 'Bir-birini qoplaydigan haftalik rejalar mavjud',
        conflictingScheduleIds: samePrioritySchedules.map(
          (schedule) => schedule.id,
        ),
      };
    }

    const weekday = this.dayIndex(dto.date);

    const isWorkDay = (firstSchedule.workingDaysMask & (1 << weekday)) !== 0;

    return {
      ...resultBase,
      status: isWorkDay ? 'WORK_DAY' : 'DAY_OFF',
      source: 'WEEKLY_SCHEDULE',
      scheduleId: firstSchedule.id,
      workingDaysMask: firstSchedule.workingDaysMask,
      weekdayIndex: weekday,
    };
  }

  async resolveForAttendanceDay(
    date: string,
    membershipType: MembershipType,
    targets: AttendanceCalendarTarget[],
  ): Promise<Map<string, AttendanceCalendarState>> {
    const result = new Map<string, AttendanceCalendarState>();

    if (targets.length === 0) {
      return result;
    }

    const uniqueTargets = new Map<string, AttendanceCalendarTarget>();

    for (const target of targets) {
      uniqueTargets.set(
        attendanceCalendarKey(target.schoolId, target.classId),
        target,
      );
    }

    const items = [...uniqueTargets.values()];
    const schoolIds = [...new Set(items.map((item) => item.schoolId))];

    const classIds = [
      ...new Set(
        items
          .map((item) => item.classId)
          .filter((id): id is number => id !== null),
      ),
    ];

    const academicYear = this.academicYear(date);
    const weekday = this.dayIndex(date);

    // Maktablar, sinflar va kalendar sozlamalarini
    // ommaviy yuklaymiz. Har bir o'quvchi uchun
    // alohida SQL so'rovi yuborilmaydi.
    const [schools, classes, rules, schedules] = await Promise.all([
      this.dataSource.getRepository(School).find({
        where: { id: In(schoolIds) },
        relations: { district: true },
      }),

      classIds.length > 0
        ? this.dataSource.getRepository(SchoolClass).find({
            where: {
              id: In(classIds),
              academicYear,
            },
          })
        : Promise.resolve([] as SchoolClass[]),

      this.dataSource
        .getRepository(AttendanceCalendarRule)
        .createQueryBuilder('rule')
        .where('rule.isActive = :active', {
          active: true,
        })
        .andWhere('rule.startDate <= :date', { date })
        .andWhere('rule.endDate >= :date', { date })
        .andWhere('(rule.appliesTo = :audience OR rule.appliesTo = :both)', {
          audience:
            membershipType === MembershipType.STUDENT
              ? CalendarAppliesTo.STUDENT
              : CalendarAppliesTo.TEACHER,
          both: CalendarAppliesTo.BOTH,
        })
        .getMany(),

      this.dataSource
        .getRepository(AttendanceWeeklySchedule)
        .createQueryBuilder('schedule')
        .where('schedule.schoolId IN (:...schoolIds)', {
          schoolIds,
        })
        .andWhere('schedule.academicYear = :academicYear', { academicYear })
        .andWhere('schedule.membershipType = :membershipType', {
          membershipType,
        })
        .andWhere('schedule.effectiveFrom <= :date', {
          date,
        })
        .andWhere(
          '(schedule.effectiveTo IS NULL OR schedule.effectiveTo >= :date)',
          { date },
        )
        .getMany(),
    ]);

    const schoolMap = new Map(schools.map((school) => [school.id, school]));

    const classMap = new Map(
      classes.map((schoolClass) => [schoolClass.id, schoolClass]),
    );

    for (const item of items) {
      const key = attendanceCalendarKey(item.schoolId, item.classId);

      const school = schoolMap.get(item.schoolId);

      if (!school) {
        result.set(key, 'UNCONFIGURED');
        continue;
      }

      const isStudent = membershipType === MembershipType.STUDENT;

      const schoolClass =
        item.classId !== null ? classMap.get(item.classId) : undefined;

      if (isStudent && (!schoolClass || schoolClass.schoolId !== school.id)) {
        result.set(key, 'UNCONFIGURED');
        continue;
      }

      const applicableRules = rules
        .filter((rule) => {
          switch (rule.scopeType) {
            case CalendarScopeType.GLOBAL:
              return true;

            case CalendarScopeType.REGION:
              return rule.regionId === school.district.regionId;

            case CalendarScopeType.DISTRICT:
              return rule.districtId === school.districtId;

            case CalendarScopeType.SCHOOL:
              return (
                rule.schoolId === school.id &&
                (rule.classId === null ||
                  (isStudent && rule.classId === item.classId))
              );

            default:
              return false;
          }
        })
        .sort(
          (a, b) => this.rulePriority(b) - this.rulePriority(a) || a.id - b.id,
        );

      if (applicableRules.length > 0) {
        const first = applicableRules[0];
        const priority = this.rulePriority(first);

        const samePriority = applicableRules.filter(
          (rule) => this.rulePriority(rule) === priority,
        );

        const conflict = samePriority.some(
          (rule) => rule.dayType !== first.dayType,
        );

        result.set(key, conflict ? 'CONFLICT' : first.dayType);

        continue;
      }

      // Maxsus qoida yo'q: haftalik jadvalni olamiz.
      const applicableSchedules = schedules
        .filter((schedule) => {
          if (schedule.schoolId !== school.id) {
            return false;
          }

          if (!isStudent) {
            return (
              schedule.classId === null &&
              schedule.gradeFrom === null &&
              schedule.gradeTo === null
            );
          }

          if (schedule.classId !== null) {
            return schedule.classId === item.classId;
          }

          const grade = schoolClass?.gradeLevel;

          return (
            grade != null &&
            schedule.gradeFrom !== null &&
            schedule.gradeTo !== null &&
            grade >= schedule.gradeFrom &&
            grade <= schedule.gradeTo
          );
        })
        .sort(
          (a, b) =>
            Number(b.classId !== null) - Number(a.classId !== null) ||
            a.id - b.id,
        );

      if (applicableSchedules.length === 0) {
        result.set(key, 'UNCONFIGURED');
        continue;
      }

      const selected = applicableSchedules[0];

      const samePrioritySchedules = applicableSchedules.filter(
        (schedule) =>
          (schedule.classId !== null) === (selected.classId !== null),
      );

      if (samePrioritySchedules.length > 1) {
        result.set(key, 'CONFLICT');
        continue;
      }

      const isWorkingDay = (selected.workingDaysMask & (1 << weekday)) !== 0;

      result.set(key, isWorkingDay ? 'WORK_DAY' : 'DAY_OFF');
    }

    return result;
  }
}
