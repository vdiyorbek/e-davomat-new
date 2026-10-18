import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';

import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import { TerminalDirection } from '../terminals/enums/terminal-direction.enum';

import { DailyAttendance } from './daily-attendance.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import {
  AttendanceExcuse,
  AttendanceExcuseStatus,
} from '../attendance-excuses/attendance-excuse.entity';
import {
  AttendanceStatusFilter,
  GetDailyAttendanceQueryDto,
} from './dto/get-daily-attendance-query.dto';

import {
  CalendarResolverService,
  attendanceCalendarKey,
} from '../attendance-calendar/calendar-resolver.service';

@Injectable()
export class DailyAttendanceReadService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly calendarResolver: CalendarResolverService,
  ) {}

  private scopedQuery(user: AuthenticatedUser) {
    const builder = this.dataSource
      .getRepository(DailyAttendance)
      .createQueryBuilder('daily')
      .innerJoinAndSelect('daily.school', 'school')
      .innerJoinAndSelect('daily.district', 'district')
      .innerJoinAndSelect('daily.region', 'region')
      .leftJoinAndSelect('daily.firstInEvent', 'firstInEvent')
      .leftJoinAndSelect('daily.lastOutEvent', 'lastOutEvent');

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        builder.andWhere('daily.regionId = :scopeRegionId', {
          scopeRegionId: user.regionId,
        });
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        builder.andWhere('daily.districtId = :scopeDistrictId', {
          scopeDistrictId: user.districtId,
        });
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        builder.andWhere('daily.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Davomat ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
    }

    return builder;
  }

  private filteredQuery(
    query: GetDailyAttendanceQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
  ) {
    const builder = this.scopedQuery(user).andWhere('daily.date = :date', {
      date: query.date,
    });
    builder.andWhere('daily.membershipType = :membershipType', {
      membershipType,
    });

    // O‘quvchi aynan tanlangan sanada
    // shu maktabda o‘qiyotgan bo‘lishi kerak.
    if (
      membershipType === MembershipType.TEACHER &&
      query.classId !== undefined
    ) {
      throw new BadRequestException(
        'O‘qituvchilar davomati uchun sinf filtri mavjud emas',
      );
    }
    const activeMembershipExists = `
  EXISTS (
    SELECT 1
    FROM school_memberships AS sm
    INNER JOIN persons AS p
      ON p.id = sm.personId
    WHERE sm.schoolId = daily.schoolId
      AND sm.type = :membershipType
      AND p.pnfl = daily.pnfl
      AND p.deletedAt IS NULL
      AND sm.startDate <= daily.date
      AND (
        sm.endDate IS NULL
        OR sm.endDate > daily.date
      )
      ${
        membershipType === MembershipType.STUDENT && query.classId !== undefined
          ? 'AND sm.classId = :filterClassId'
          : ''
      }
  )
`;

    builder.andWhere(activeMembershipExists, {
      membershipType,
    });

    if (
      membershipType === MembershipType.STUDENT &&
      query.classId !== undefined
    ) {
      builder.setParameter('filterClassId', query.classId);
    }

    if (query.regionId !== undefined) {
      builder.andWhere('daily.regionId = :filterRegionId', {
        filterRegionId: query.regionId,
      });
    }

    if (query.districtId !== undefined) {
      builder.andWhere('daily.districtId = :filterDistrictId', {
        filterDistrictId: query.districtId,
      });
    }

    if (query.schoolId !== undefined) {
      builder.andWhere('daily.schoolId = :filterSchoolId', {
        filterSchoolId: query.schoolId,
      });
    }

    if (query.pnfl !== undefined) {
      builder.andWhere('daily.pnfl = :filterPnfl', {
        filterPnfl: query.pnfl,
      });
    }

    // Ism yoki familiya orqali qidirish.
    if (query.search) {
      const escaped = query.search.replace(/[!%_]/g, (char) => `!${char}`);

      builder.andWhere(
        `EXISTS (
        SELECT 1
        FROM persons AS personSearch
        WHERE personSearch.pnfl = daily.pnfl
          AND personSearch.deletedAt IS NULL
          AND (
            personSearch.firstName
              LIKE :search ESCAPE '!'
            OR personSearch.lastName
              LIKE :search ESCAPE '!'
            OR personSearch.middleName
              LIKE :search ESCAPE '!'
            OR CONCAT_WS(
              ' ',
              personSearch.lastName,
              personSearch.firstName,
              personSearch.middleName
            ) LIKE :search ESCAPE '!'
          )
      )`,
        {
          search: `%${escaped}%`,
        },
      );
    }

    // ACTIVE ariza mavjudligini SQL orqali tekshiramiz.
    const excuseExists = `
    EXISTS (
      SELECT 1
      FROM attendance_excuses AS excuseFilter
      INNER JOIN persons AS excusePerson
        ON excusePerson.id = excuseFilter.personId
      WHERE excuseFilter.schoolId = daily.schoolId
        AND excusePerson.pnfl = daily.pnfl
        AND excuseFilter.status = :activeExcuseStatus
        AND excuseFilter.startDate <= daily.date
        AND excuseFilter.endDate >= daily.date
    )
  `;
    const studentStatusExpression = `
  CASE
    WHEN daily.firstInTime IS NOT NULL
      AND daily.lastOutTime IS NOT NULL
      THEN 'left'

    WHEN daily.firstInTime IS NOT NULL
      THEN 'inside'

    WHEN daily.lastOutTime IS NOT NULL
      THEN 'anomaly'

    WHEN ${excuseExists}
      THEN 'excused'

    ELSE 'absent'
  END
`;

    const teacherStatusExpression = `
  CASE
    WHEN daily.firstInTime IS NOT NULL
      AND daily.lastOutTime IS NOT NULL
      THEN 'left'

    WHEN daily.firstInTime IS NOT NULL
      THEN 'inside'

    WHEN daily.lastOutTime IS NOT NULL
      THEN 'anomaly'

    ELSE 'absent'
  END
`;
    // Muhim: status MySQL ichida aniqlanadi.
    // Shuning uchun filtr paginationdan OLDIN ishlaydi.

    if (
      membershipType === MembershipType.TEACHER &&
      query.attendanceStatus === AttendanceStatusFilter.EXCUSED
    ) {
      throw new BadRequestException(
        'O‘qituvchilar uchun sababli status mavjud emas',
      );
    }

    if (query.attendanceStatus === AttendanceStatusFilter.INSIDE) {
      // Kelgan: chiqib ketganlar ham shu filtrga kiradi.
      builder.andWhere('daily.firstInTime IS NOT NULL');
    } else if (query.attendanceStatus === AttendanceStatusFilter.ABSENT) {
      // Kirish qayd etilmaganlar.
      builder.andWhere('daily.firstInTime IS NULL');

      if (membershipType === MembershipType.STUDENT) {
        // Sababli o‘quvchilar chiqariladi.
        // Faqat chiqish qaydi mavjud noodatiy holatlar
        // esa tekshiruv uchun Kelmagan tarkibida qoladi.
        builder.andWhere(
          `(daily.lastOutTime IS NOT NULL OR NOT ${excuseExists})`,
        );

        builder.setParameter(
          'activeExcuseStatus',
          AttendanceExcuseStatus.ACTIVE,
        );
      }
    } else if (query.attendanceStatus !== undefined) {
      const statusExpression =
        membershipType === MembershipType.STUDENT
          ? studentStatusExpression
          : teacherStatusExpression;

      builder.andWhere(`(${statusExpression}) = :filterAttendanceStatus`, {
        filterAttendanceStatus: query.attendanceStatus,
      });

      if (membershipType === MembershipType.STUDENT) {
        builder.setParameter(
          'activeExcuseStatus',
          AttendanceExcuseStatus.ACTIVE,
        );
      }
    }

    return builder;
  }

  async findAll(
    query: GetDailyAttendanceQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType = MembershipType.STUDENT,
  ) {
    const builder = this.filteredQuery(query, user, membershipType);
    const [rows, total] = await builder
      .orderBy('daily.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const pnfls = [...new Set(rows.map((row) => row.pnfl))];

    const persons = pnfls.length
      ? await this.dataSource.getRepository(Person).find({
          where: {
            pnfl: In(pnfls),
          },
          select: {
            id: true,
            pnfl: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        })
      : [];

    const personsByPnfl = new Map(
      persons.map((person) => [person.pnfl, person]),
    );

    const schoolIds = [...new Set(rows.map((row) => row.schoolId))];

    // Tanlangan sanadagi sinfni aniqlaymiz.
    const membershipRows =
      pnfls.length > 0 && schoolIds.length > 0
        ? await this.dataSource
            .getRepository(SchoolMembership)
            .createQueryBuilder('membership')
            .innerJoin('membership.person', 'person')
            .leftJoin('membership.schoolClass', 'schoolClass')
            .select('person.pnfl', 'pnfl')
            .addSelect('membership.schoolId', 'schoolId')
            .addSelect('membership.classId', 'classId')
            .addSelect('schoolClass.name', 'className')
            .addSelect('schoolClass.academicYear', 'academicYear')
            .where('person.pnfl IN (:...pnfls)', { pnfls })
            .andWhere('membership.schoolId IN (:...schoolIds)', {
              schoolIds,
            })
            .andWhere('membership.type = :membershipType', {
              membershipType,
            })
            .andWhere('membership.startDate <= :date', {
              date: query.date,
            })
            .andWhere(
              '(membership.endDate IS NULL OR membership.endDate > :date)',
              { date: query.date },
            )
            .orderBy('membership.startDate', 'DESC')
            .addOrderBy('membership.id', 'DESC')
            .getRawMany<{
              pnfl: string;
              schoolId: number | string;
              classId: number | string | null;
              className: string | null;
              academicYear: string | null;
            }>()
        : [];

    const classBySchoolAndPnfl = new Map<
      string,
      (typeof membershipRows)[number]
    >();

    for (const membership of membershipRows) {
      const key = `${membership.schoolId}:${membership.pnfl}`;

      // Bir nechta yozuv bo‘lsa, shu kundagi
      // eng oxirgi boshlangan biriktirish olinadi.
      if (!classBySchoolAndPnfl.has(key)) {
        classBySchoolAndPnfl.set(key, membership);
      }
    }

    const calendarStates = await this.calendarResolver.resolveForAttendanceDay(
      query.date,
      membershipType,
      rows.map((row) => {
        const membership = classBySchoolAndPnfl.get(
          `${row.schoolId}:${row.pnfl}`,
        );

        return {
          schoolId: row.schoolId,
          classId:
            membershipType === MembershipType.STUDENT &&
            membership?.classId != null
              ? Number(membership.classId)
              : null,
        };
      }),
    );

    const personIds = [...new Set(persons.map((p) => p.id))];

    // Sahifadagi barcha o‘quvchilar uchun sababli
    // arizalarni bitta so‘rovda olamiz.
    const excuses =
      membershipType === MembershipType.STUDENT &&
      personIds.length > 0 &&
      schoolIds.length > 0
        ? await this.dataSource.getRepository(AttendanceExcuse).find({
            select: {
              id: true,
              personId: true,
              schoolId: true,
              reason: true,
            },
            where: {
              personId: In(personIds),
              schoolId: In(schoolIds),
              status: AttendanceExcuseStatus.ACTIVE,
              startDate: LessThanOrEqual(query.date),
              endDate: MoreThanOrEqual(query.date),
            },
          })
        : [];

    // Bir o‘quvchi bir nechta maktabda tarixga ega
    // bo‘lishi mumkin, shuning uchun ikkala ID kerak.
    const excusesByPair = new Map(
      excuses.map((excuse) => [
        `${excuse.schoolId}:${excuse.personId}`,
        excuse,
      ]),
    );

    return {
      data: rows.map((row) => {
        const person = personsByPnfl.get(row.pnfl);

        const membership = classBySchoolAndPnfl.get(
          `${row.schoolId}:${row.pnfl}`,
        );

        const excuse = person
          ? excusesByPair.get(`${row.schoolId}:${person.id}`)
          : undefined;

        const hasActiveExcuse = Boolean(excuse);
        const attendanceStatus =
          row.firstInTime && row.lastOutTime
            ? 'left'
            : row.firstInTime
              ? 'inside'
              : row.lastOutTime
                ? 'anomaly'
                : membershipType === MembershipType.STUDENT && hasActiveExcuse
                  ? 'excused'
                  : 'absent';

        const firstPhotoReady =
          row.firstInEvent?.photoStatus === EventPhotoStatus.DOWNLOADED &&
          Boolean(row.firstInEvent.photoPath);

        const lastPhotoReady =
          row.lastOutEvent?.photoStatus === EventPhotoStatus.DOWNLOADED &&
          Boolean(row.lastOutEvent.photoPath);

        return {
          id: row.id,
          date: row.date,
          pnfl: row.pnfl,
          attendanceStatus,
          person: person
            ? {
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                middleName: person.middleName,
              }
            : null,

          firstInTime: row.firstInTime,
          firstInEventId: row.firstInEventId,
          firstInUrl: firstPhotoReady
            ? `/api/daily-attendance/${row.id}/photos/in`
            : null,
          firstInPhotoStatus: row.firstInEvent?.photoStatus ?? null,

          lastOutTime: row.lastOutTime,
          lastOutEventId: row.lastOutEventId,
          lastOutUrl: lastPhotoReady
            ? `/api/daily-attendance/${row.id}/photos/out`
            : null,
          lastOutPhotoStatus: row.lastOutEvent?.photoStatus ?? null,

          schoolId: row.schoolId,
          districtId: row.districtId,
          regionId: row.regionId,

          school: {
            id: row.school.id,
            name: row.school.name,
          },
          district: {
            id: row.district.id,
            name: row.district.name,
          },
          region: {
            id: row.region.id,
            name: row.region.name,
          },
          classId:
            membership?.classId != null ? Number(membership.classId) : null,

          className: membership?.className ?? null,
          membershipType: row.membershipType,

          academicYear: membership?.academicYear ?? null,

          excuseId:
            attendanceStatus === 'excused' ? (excuse?.id ?? null) : null,

          excuseReason:
            attendanceStatus === 'excused' ? (excuse?.reason ?? null) : null,

          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          calendarStatus:
            calendarStates.get(
              attendanceCalendarKey(
                row.schoolId,
                membershipType === MembershipType.STUDENT &&
                  membership?.classId != null
                  ? Number(membership.classId)
                  : null,
              ),
            ) ?? 'UNCONFIGURED',
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async readPhoto(
    id: string,
    direction: string,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    // bigint ID’ni Number’ga aylantirmaymiz.
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n) {
      throw new BadRequestException('Davomat identifikatori noto‘g‘ri');
    }

    if (direction !== 'in' && direction !== 'out') {
      throw new BadRequestException(
        'Rasm yo‘nalishi in yoki out bo‘lishi kerak',
      );
    }

    const row = await this.scopedQuery(user)
      .andWhere('daily.id = :id', { id })
      .getOne();

    if (!row) {
      throw new NotFoundException('Davomat yozuvi topilmadi');
    }

    const event = direction === 'in' ? row.firstInEvent : row.lastOutEvent;

    const expectedDirection =
      direction === 'in' ? TerminalDirection.IN : TerminalDirection.OUT;

    if (
      !event ||
      event.pnfl !== row.pnfl ||
      event.schoolId !== row.schoolId ||
      event.direction !== expectedDirection ||
      event.photoStatus !== EventPhotoStatus.DOWNLOADED ||
      !event.photoPath
    ) {
      throw new NotFoundException('Davomat rasmi mavjud emas');
    }

    const root = resolve(process.cwd(), 'uploads', 'attendance');
    const filePath = resolve(process.cwd(), event.photoPath);
    const relativePath = relative(root, filePath);

    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new NotFoundException('Rasm manzili noto‘g‘ri');
    }

    try {
      return await readFile(filePath);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT' || code === 'ENOTDIR') {
        throw new NotFoundException('Rasm fayli serverda topilmadi');
      }

      throw error;
    }
  }
}
