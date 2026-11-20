import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { TeacherMembershipDetail } from '../membership-details/teacher-membership-detail.entity';
import {
  AttendanceExcuse,
  AttendanceExcuseStatus,
} from '../attendance-excuses/attendance-excuse.entity';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import {
  AttendanceCalendarState,
  CalendarResolverService,
  attendanceCalendarKey,
} from '../attendance-calendar/calendar-resolver.service';
import { assumeWorkDay } from './assumed-work-day';
import { DailyAttendance } from './daily-attendance.entity';
import { GetPersonAttendanceQueryDto } from './dto/get-person-attendance-query.dto';

/** Batafsil oynada bir so‘rovda ko‘rsatiladigan eng uzun davr. */
const MAX_RANGE_DAYS = 31;

/** Davr berilmasa — oxirgi 14 kun. */
const DEFAULT_RANGE_DAYS = 14;

export type PersonDayStatus =
  | 'inside'
  | 'left'
  | 'anomaly'
  | 'excused'
  | 'absent'
  | 'day_off'
  | 'unconfigured'
  | 'conflict'
  | 'no_data'
  | 'no_record';

function todayInTashkent(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];

  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    dates.push(date);
  }

  return dates;
}

/**
 * Bitta o‘quvchi yoki o‘qituvchining shaxsiy ma’lumotlari va
 * tanlangan davrdagi har bir kunlik davomati (kalendar va
 * sababli arizalar hisobga olinadi).
 */
@Injectable()
export class DailyAttendancePersonService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly calendarResolver: CalendarResolverService,
  ) {}

  async history(query: GetPersonAttendanceQueryDto, user: AuthenticatedUser) {
    const membershipType = query.membershipType ?? MembershipType.STUDENT;
    const isStudent = membershipType === MembershipType.STUDENT;
    const today = todayInTashkent();
    const to = query.to ?? today;
    const from = query.from ?? shiftDate(to, -(DEFAULT_RANGE_DAYS - 1));

    if (from > to) {
      throw new BadRequestException(
        'Davr boshi davr oxiridan keyin bo‘lishi mumkin emas',
      );
    }

    if (to > today) {
      throw new BadRequestException(
        'Kelajakdagi kunlar uchun davomat ko‘rib bo‘lmaydi',
      );
    }

    const dates = enumerateDates(from, to);

    if (dates.length > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Davr ${MAX_RANGE_DAYS} kundan oshmasligi kerak`,
      );
    }

    const person = await this.dataSource.getRepository(Person).findOne({
      where: { pnfl: query.pnfl },
    });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi');
    }

    // Shaxsning shu turdagi barcha biriktirishlari — faqat
    // foydalanuvchiga ko‘rinadigan maktablar qoldiriladi.
    const allMemberships = await this.dataSource
      .getRepository(SchoolMembership)
      .find({
        where: { personId: person.id, type: membershipType },
        relations: {
          school: { district: { region: true } },
          schoolClass: true,
        },
        order: { startDate: 'DESC', id: 'DESC' },
      });

    const memberships = allMemberships.filter((membership) =>
      this.canSee(membership, user),
    );

    if (memberships.length === 0) {
      throw new NotFoundException(
        'Shaxs topilmadi yoki uni ko‘rishga ruxsat yo‘q',
      );
    }

    const visibleSchoolIds = [
      ...new Set(memberships.map((membership) => membership.schoolId)),
    ];

    // Davr oxirida faol bo‘lgan biriktirish; bo‘lmasa — eng oxirgisi.
    const current =
      memberships.find((membership) => this.isActiveOn(membership, to)) ??
      memberships[0];

    const position = isStudent
      ? null
      : ((
          await this.dataSource
            .getRepository(TeacherMembershipDetail)
            .findOne({ where: { membershipId: current.id } })
        )?.position ?? null);

    const [rows, excuses] = await Promise.all([
      this.dataSource
        .getRepository(DailyAttendance)
        .createQueryBuilder('daily')
        .leftJoinAndSelect('daily.firstInEvent', 'firstInEvent')
        .leftJoinAndSelect('daily.lastOutEvent', 'lastOutEvent')
        .where('daily.pnfl = :pnfl', { pnfl: person.pnfl })
        .andWhere('daily.membershipType = :membershipType', { membershipType })
        .andWhere('daily.schoolId IN (:...schoolIds)', {
          schoolIds: visibleSchoolIds,
        })
        .andWhere('daily.date >= :from', { from })
        .andWhere('daily.date <= :to', { to })
        .getMany(),

      this.dataSource.getRepository(AttendanceExcuse).find({
        select: {
          id: true,
          schoolId: true,
          reason: true,
          reasonNote: true,
          startDate: true,
          endDate: true,
        },
        where: {
          personId: person.id,
          membershipType,
          schoolId: In(visibleSchoolIds),
          status: AttendanceExcuseStatus.ACTIVE,
          startDate: LessThanOrEqual(to),
          endDate: MoreThanOrEqual(from),
        },
      }),
    ]);

    const rowsByDate = new Map(rows.map((row) => [row.date, row]));

    // Har bir kun uchun o‘sha kundagi biriktirish (sinf almashgan
    // bo‘lishi mumkin) va kalendar holati.
    const membershipOn = (date: string, schoolId?: number) =>
      memberships.find(
        (membership) =>
          (schoolId === undefined || membership.schoolId === schoolId) &&
          this.isActiveOn(membership, date),
      );

    const states = new Map<string, AttendanceCalendarState>();

    // Maktabda shu kuni kamida bitta kishi kelganmi — kalendar sozlanmagan
    // kunni o‘quv kuni deb faraz qilish uchun (bir so‘rov, kun/maktab bo‘yicha).
    const arrivalSchoolIds = [...new Set(rows.map((row) => row.schoolId))];
    const arrivalKeys = new Set<string>(
      arrivalSchoolIds.length > 0 && dates.length > 0
        ? (
            await this.dataSource.query<{ schoolId: number; date: string }[]>(
              `SELECT DISTINCT schoolId, DATE_FORMAT(date, '%Y-%m-%d') AS date
                 FROM daily_attendance
                WHERE firstInTime IS NOT NULL
                  AND schoolId IN (${arrivalSchoolIds.map(() => '?').join(',')})
                  AND date IN (${dates.map(() => '?').join(',')})`,
              [...arrivalSchoolIds, ...dates],
            )
          ).map((item) => `${Number(item.schoolId)}:${item.date}`)
        : [],
    );

    for (const date of dates) {
      const row = rowsByDate.get(date);
      if (!row) continue;

      const membership = membershipOn(date, row.schoolId);
      const classId = isStudent ? (membership?.classId ?? null) : null;

      const primaryOnly = !isStudent && membership?.primaryOnly === true;
      const resolved = await this.calendarResolver.resolveForAttendanceDay(
        date,
        membershipType,
        [{ schoolId: row.schoolId, classId, primaryOnly }],
      );

      states.set(
        date,
        assumeWorkDay(
          resolved.get(
            attendanceCalendarKey(row.schoolId, classId, primaryOnly),
          ) ?? 'UNCONFIGURED',
          date,
          arrivalKeys.has(`${row.schoolId}:${date}`),
        ).state,
      );
    }

    const stats: Record<PersonDayStatus, number> = {
      inside: 0,
      left: 0,
      anomaly: 0,
      excused: 0,
      absent: 0,
      day_off: 0,
      unconfigured: 0,
      conflict: 0,
      no_data: 0,
      no_record: 0,
    };

    const days = [...dates].reverse().map((date) => {
      const row = rowsByDate.get(date) ?? null;
      const membership = membershipOn(date, row?.schoolId);
      const excuse =
        excuses.find(
          (item) =>
            item.startDate <= date &&
            item.endDate >= date &&
            (!row || item.schoolId === row.schoolId),
        ) ?? null;

      const calendar = states.get(date) ?? null;

      let status: PersonDayStatus;

      if (!row) {
        status = 'no_record';
      } else if (row.firstInTime && row.lastOutTime) {
        status = 'left';
      } else if (row.firstInTime) {
        status = 'inside';
      } else if (row.lastOutTime) {
        status = 'anomaly';
      } else if (calendar === 'DAY_OFF') {
        status = 'day_off';
      } else if (calendar === 'CONFLICT') {
        status = 'conflict';
      } else if (calendar !== 'WORK_DAY') {
        status = 'unconfigured';
      } else if (excuse) {
        status = 'excused';
      } else if (!arrivalKeys.has(`${row.schoolId}:${date}`)) {
        // Maktabdan shu kuni umuman ma’lumot kelmagan: «kelmagan» deb bo‘lmaydi.
        status = 'no_data';
      } else {
        status = 'absent';
      }

      stats[status] += 1;

      const photoReady = (event: DailyAttendance['firstInEvent']) =>
        event?.photoStatus === EventPhotoStatus.DOWNLOADED &&
        Boolean(event.photoPath);

      return {
        date,
        dailyId: row?.id ?? null,
        status,
        firstInTime: row?.firstInTime ?? null,
        lastOutTime: row?.lastOutTime ?? null,
        firstInUrl:
          row && photoReady(row.firstInEvent)
            ? `/api/daily-attendance/${row.id}/photos/in`
            : null,
        lastOutUrl:
          row && photoReady(row.lastOutEvent)
            ? `/api/daily-attendance/${row.id}/photos/out`
            : null,
        schoolName: membership?.school.name ?? null,
        className: isStudent ? (membership?.schoolClass?.name ?? null) : null,
        excuse:
          excuse && (status === 'excused' || status === 'absent' || !row)
            ? {
                id: excuse.id,
                reason: excuse.reason,
                reasonNote: excuse.reasonNote,
              }
            : null,
      };
    });

    return {
      membershipType,
      from,
      to,
      person: {
        id: person.id,
        pnfl: person.pnfl,
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        gender: person.gender,
        nationality: person.nationality,
        birthDate: person.birthDate,
        phoneNumber: person.phoneNumber,
        address: person.address,
        photoUrl: person.photoUrl,
      },
      membership: {
        id: current.id,
        startDate: current.startDate,
        endDate: current.endDate,
        active: this.isActiveOn(current, to),
        position,
        school: {
          id: current.school.id,
          name: current.school.name,
        },
        district: {
          id: current.school.district.id,
          name: current.school.district.name,
        },
        region: {
          id: current.school.district.region.id,
          name: current.school.district.region.name,
        },
        schoolClass: current.schoolClass
          ? {
              id: current.schoolClass.id,
              name: current.schoolClass.name,
              gradeLevel: current.schoolClass.gradeLevel,
            }
          : null,
      },
      stats,
      days,
    };
  }

  private isActiveOn(membership: SchoolMembership, date: string): boolean {
    return (
      membership.startDate <= date &&
      (membership.endDate === null || membership.endDate > date)
    );
  }

  private canSee(membership: SchoolMembership, user: AuthenticatedUser) {
    const school = membership.school;

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return true;
      case UserRole.REGION_ADMIN:
        return (
          user.regionId !== null &&
          user.regionId !== undefined &&
          school.district.regionId === user.regionId
        );
      case UserRole.DISTRICT_ADMIN:
        return (
          user.districtId !== null &&
          user.districtId !== undefined &&
          school.districtId === user.districtId
        );
      case UserRole.SCHOOL_ADMIN:
        return (
          user.schoolId !== null &&
          user.schoolId !== undefined &&
          school.id === user.schoolId
        );
      default:
        return false;
    }
  }
}
