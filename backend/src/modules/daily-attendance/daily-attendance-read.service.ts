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
import { SchoolClass } from '../classes/school-class.entity';
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

  private async getWorkingDayCondition(
    query: GetDailyAttendanceQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
  ): Promise<{
    sql: string;
    params: Record<string, number[]>;
  }> {
    // Faqat ushbu administratorga ko'rinadigan va
    // tanlangan sanada davomat yozuvi bor maktablar.
    const schoolsQuery = this.scopedQuery(user)
      .select('daily.schoolId', 'schoolId')
      .distinct(true)
      .andWhere('daily.date = :date', { date: query.date })
      .andWhere('daily.membershipType = :membershipType', {
        membershipType,
      });

    if (query.schoolId !== undefined) {
      schoolsQuery.andWhere('daily.schoolId = :selectedSchoolId', {
        selectedSchoolId: query.schoolId,
      });
    }

    if (query.regionId !== undefined) {
      schoolsQuery.andWhere('daily.regionId = :selectedRegionId', {
        selectedRegionId: query.regionId,
      });
    }

    if (query.districtId !== undefined) {
      schoolsQuery.andWhere('daily.districtId = :selectedDistrictId', {
        selectedDistrictId: query.districtId,
      });
    }

    const schoolRows = await schoolsQuery.getRawMany<{
      schoolId: number | string;
    }>();

    const schoolIds = [
      ...new Set(schoolRows.map((row) => Number(row.schoolId))),
    ];

    if (!schoolIds.length) {
      return { sql: '1 = 0', params: {} };
    }

    // O'qituvchilar uchun maktab bo'yicha jadval.
    if (membershipType === MembershipType.TEACHER) {
      const states = await this.calendarResolver.resolveForAttendanceDay(
        query.date,
        membershipType,
        schoolIds.map((schoolId) => ({
          schoolId,
          classId: null,
        })),
      );

      const workingSchoolIds = schoolIds.filter(
        (schoolId) =>
          states.get(attendanceCalendarKey(schoolId, null)) === 'WORK_DAY',
      );

      if (!workingSchoolIds.length) {
        return { sql: '1 = 0', params: {} };
      }

      return {
        sql: 'daily.schoolId IN (:...calendarWorkingSchools)',
        params: {
          calendarWorkingSchools: workingSchoolIds,
        },
      };
    }

    // O'quvchilarning sinf darajalari tegishli
    // o'quv yilidan olinadi.
    const year = Number(query.date.slice(0, 4));
    const month = Number(query.date.slice(5, 7));
    const startYear = month >= 9 ? year : year - 1;
    const academicYear = `${startYear}-${startYear + 1}`;

    const schoolClasses = await this.dataSource
      .getRepository(SchoolClass)
      .find({
        where: {
          schoolId: In(schoolIds),
          academicYear,
        },
      });

    const states = await this.calendarResolver.resolveForAttendanceDay(
      query.date,
      membershipType,
      schoolClasses.map((schoolClass) => ({
        schoolId: schoolClass.schoolId,
        classId: schoolClass.id,
      })),
    );

    const workingClassIds = schoolClasses
      .filter(
        (schoolClass) =>
          states.get(
            attendanceCalendarKey(schoolClass.schoolId, schoolClass.id),
          ) === 'WORK_DAY',
      )
      .map((schoolClass) => schoolClass.id);

    if (!workingClassIds.length) {
      return { sql: '1 = 0', params: {} };
    }

    // Davomat qatoriga mos o'quvchining aynan
    // shu kundagi oxirgi faol sinf biriktirilishini
    // tekshiramiz.
    const sql = `
    EXISTS (
      SELECT 1
      FROM school_memberships AS cm
      INNER JOIN persons AS cp
        ON cp.id = cm.personId
      WHERE cm.schoolId = daily.schoolId
        AND cp.pnfl = daily.pnfl
        AND cp.deletedAt IS NULL
        AND cm.type = :membershipType
        AND cm.startDate <= daily.date
        AND (
          cm.endDate IS NULL
          OR cm.endDate > daily.date
        )
        AND cm.classId IN (:...calendarWorkingClasses)
        AND NOT EXISTS (
          SELECT 1
          FROM school_memberships AS newer
          WHERE newer.personId = cm.personId
            AND newer.schoolId = cm.schoolId
            AND newer.type = cm.type
            AND newer.startDate <= daily.date
            AND (
              newer.endDate IS NULL
              OR newer.endDate > daily.date
            )
            AND (
              newer.startDate > cm.startDate
              OR (
                newer.startDate = cm.startDate
                AND newer.id > cm.id
              )
            )
        )
    )
  `;

    return {
      sql,
      params: {
        calendarWorkingClasses: workingClassIds,
      },
    };
  }

  private async filteredQuery(
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

    // Sababli ariza mavjudligini tekshirish.
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

    const status = query.attendanceStatus;

    if (
      membershipType === MembershipType.TEACHER &&
      status === AttendanceStatusFilter.EXCUSED
    ) {
      throw new BadRequestException(
        'O‘qituvchilar uchun sababli status mavjud emas',
      );
    }

    if (status === AttendanceStatusFilter.INSIDE) {
      // "Kelgan" filtri ketganlarni ham qamrab oladi.
      builder.andWhere('daily.firstInTime IS NOT NULL');
    } else if (status === AttendanceStatusFilter.LEFT) {
      builder
        .andWhere('daily.firstInTime IS NOT NULL')
        .andWhere('daily.lastOutTime IS NOT NULL');
    } else if (status === AttendanceStatusFilter.ANOMALY) {
      builder
        .andWhere('daily.firstInTime IS NULL')
        .andWhere('daily.lastOutTime IS NOT NULL');
    } else if (
      status === AttendanceStatusFilter.ABSENT ||
      status === AttendanceStatusFilter.EXCUSED
    ) {
      // Kalendar SQL sahifalash va COUNT dan oldin
      // ishlaydi.
      const workday = await this.getWorkingDayCondition(
        query,
        user,
        membershipType,
      );

      builder
        .andWhere('daily.firstInTime IS NULL')
        .andWhere('daily.lastOutTime IS NULL')
        .andWhere(workday.sql, workday.params);

      if (membershipType === MembershipType.STUDENT) {
        builder.setParameter(
          'activeExcuseStatus',
          AttendanceExcuseStatus.ACTIVE,
        );

        builder.andWhere(
          status === AttendanceStatusFilter.EXCUSED
            ? excuseExists
            : `NOT ${excuseExists}`,
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
    const builder = await this.filteredQuery(query, user, membershipType);
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

        const calendarStatus =
          calendarStates.get(
            attendanceCalendarKey(
              row.schoolId,
              membershipType === MembershipType.STUDENT &&
                membership?.classId != null
                ? Number(membership.classId)
                : null,
            ),
          ) ?? 'UNCONFIGURED';

        const attendanceStatus =
          row.firstInTime && row.lastOutTime
            ? 'left'
            : row.firstInTime
              ? 'inside'
              : row.lastOutTime
                ? 'anomaly'
                : calendarStatus === 'DAY_OFF'
                  ? 'day_off'
                  : calendarStatus === 'CONFLICT'
                    ? 'conflict'
                    : calendarStatus === 'UNCONFIGURED'
                      ? 'unconfigured'
                      : membershipType === MembershipType.STUDENT &&
                          hasActiveExcuse
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
          calendarStatus,
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
