import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { Person } from '../persons/person.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { AttendanceExcuseStatus } from '../attendance-excuses/attendance-excuse.entity';
import {
  AttendanceCalendarState,
  CalendarResolverService,
  attendanceCalendarKey,
} from '../attendance-calendar/calendar-resolver.service';
import { assumeWorkDay } from './assumed-work-day';
import { DailyAttendance } from './daily-attendance.entity';
import { GetAttendanceSummaryQueryDto } from './dto/get-attendance-summary-query.dto';

/** Natija qaysi kesimda guruhlanadi. */
export type AttendanceSummaryLevel = 'REGION' | 'DISTRICT' | 'SCHOOL' | 'CLASS';

/** Davomat darajasi: past / o‘rtacha / yuqori. */
export type AttendanceSummaryBand = 'LOW' | 'MEDIUM' | 'HIGH';

/** Bir so‘rovda ko‘rish mumkin bo‘lgan eng uzun davr. */
const MAX_RANGE_DAYS = 31;

/** Foiz shu qiymatdan past bo‘lsa — «Yomon». */
const BAND_LOW_BELOW = 56;

/** Foiz shu qiymatdan yuqori bo‘lsa — «A’lo». */
const BAND_HIGH_ABOVE = 86;

/** Sinfi aniqlanmagan o‘quvchilar guruhi. */
const NO_CLASS_ID = 0;

interface Counters {
  /** Davrdagi jami kishi-kunlar. */
  personDays: number;
  present: number;
  absent: number;
  excused: number;
  dayOff: number;
  /** Kalendar sozlanmagan yoki ziddiyatli kunlardagi kelmaganlar. */
  unknown: number;
  /** Ish kunlaridagi jami kishi-kunlar (foiz maxraji). */
  expected: number;
  /** Ish kunlarida kelgan + sababli (foiz suratidagi qiymat). */
  attended: number;
}

interface DayRow {
  date: string;
  schoolId: number | string;
  districtId: number | string;
  regionId: number | string;
  classId: number | string | null;
  /** O‘qituvchi: 1 — faqat boshlang‘ich sinflarda dars beradi. */
  primaryOnly?: number | string | null;
  total: number | string;
  present: number | string | null;
  excused: number | string | null;
}

interface PlaceColumns {
  region: string;
  district: string;
  school: string;
}

/**
 * Kelmagan qatorda shu kunni qamraydigan faol sababli
 * ariza bormi? `CASE` ichida ishlatiladi — faqat kelmaganlar
 * uchun bajariladi.
 */
const EXCUSE_EXISTS_SQL = `EXISTS (
  SELECT 1
  FROM attendance_excuses AS summaryExcuse
  INNER JOIN persons AS summaryExcusePerson
    ON summaryExcusePerson.id = summaryExcuse.personId
  WHERE summaryExcuse.schoolId = daily.schoolId
    AND summaryExcusePerson.pnfl = daily.pnfl
    AND summaryExcuse.membershipType = daily.membershipType
    AND summaryExcuse.status = :activeExcuseStatus
    AND summaryExcuse.startDate <= daily.date
    AND summaryExcuse.endDate >= daily.date
)`;

function emptyCounters(): Counters {
  return {
    personDays: 0,
    present: 0,
    absent: 0,
    excused: 0,
    dayOff: 0,
    unknown: 0,
    expected: 0,
    attended: 0,
  };
}

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

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function bandOf(rate: number | null): AttendanceSummaryBand | null {
  if (rate === null) return null;
  if (rate < BAND_LOW_BELOW) return 'LOW';
  if (rate > BAND_HIGH_ABOVE) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Hududlar kesimida davomat: viloyat → tuman → maktab → sinf.
 * `daily_attendance` jadvalidan kun va maktab (o‘quvchilar uchun —
 * sinf) bo‘yicha guruhlangan sonlar olinadi, so‘ng har bir kun uchun
 * o‘quv kalendari qo‘llanadi: dam olish kunidagi kelmaganlar
 * «sababsiz» hisoblanmaydi.
 */
@Injectable()
export class DailyAttendanceSummaryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly calendarResolver: CalendarResolverService,
  ) {}

  async summary(query: GetAttendanceSummaryQueryDto, user: AuthenticatedUser) {
    const membershipType = query.membershipType ?? MembershipType.STUDENT;
    const isStudent = membershipType === MembershipType.STUDENT;

    if (!isStudent && query.classId !== undefined) {
      throw new BadRequestException(
        'O‘qituvchilar davomati uchun sinf filtri mavjud emas',
      );
    }

    const today = todayInTashkent();
    const from = query.from ?? query.to ?? today;
    const to = query.to ?? from;

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

    const level = this.resolveLevel(query, user, isStudent);

    // 1. Kun × maktab (× sinf) bo‘yicha sonlar.
    const dayQuery = this.baseQuery(
      query,
      user,
      membershipType,
      from,
      to,
      isStudent,
      !isStudent,
    )
      .select("DATE_FORMAT(daily.date, '%Y-%m-%d')", 'date')
      .addSelect('daily.schoolId', 'schoolId')
      .addSelect('MAX(daily.districtId)', 'districtId')
      .addSelect('MAX(daily.regionId)', 'regionId')
      .addSelect(isStudent ? 'cls.classId' : 'NULL', 'classId')
      // O‘qituvchilar: «faqat 1–4 sinf» haftasidagilar alohida guruh.
      .addSelect(isStudent ? 'NULL' : 'cls.primaryOnly', 'primaryOnly')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'SUM(daily.firstInTime IS NOT NULL OR daily.lastOutTime IS NOT NULL)',
        'present',
      )
      .addSelect(
        `SUM(CASE WHEN daily.firstInTime IS NULL AND daily.lastOutTime IS NULL THEN ${EXCUSE_EXISTS_SQL} ELSE 0 END)`,
        'excused',
      )
      .setParameter('activeExcuseStatus', AttendanceExcuseStatus.ACTIVE)
      .groupBy('daily.date')
      .addGroupBy('daily.schoolId');

    if (isStudent) {
      dayQuery.addGroupBy('cls.classId');
    } else {
      dayQuery.addGroupBy('cls.primaryOnly');
    }

    const dayRows = await dayQuery.getRawMany<DayRow>();

    // 2. Har bir kun uchun kalendar holati (bir kunga bitta
    //    ommaviy so‘rov — o‘quvchi bo‘yicha emas).
    const statesByDate = new Map<
      string,
      Map<string, AttendanceCalendarState>
    >();
    const rowsByDate = new Map<string, DayRow[]>();

    for (const row of dayRows) {
      const list = rowsByDate.get(row.date) ?? [];
      list.push(row);
      rowsByDate.set(row.date, list);
    }

    for (const [date, rows] of rowsByDate) {
      statesByDate.set(
        date,
        await this.calendarResolver.resolveForAttendanceDay(
          date,
          membershipType,
          rows.map((row) => ({
            schoolId: Number(row.schoolId),
            classId:
              isStudent && row.classId !== null ? Number(row.classId) : null,
            primaryOnly: !isStudent && Number(row.primaryOnly) === 1,
          })),
        ),
      );
    }

    // Maktab/kun bo‘yicha kelganlar: kalendar sozlanmagan kunni (maktabda kamida
    // bitta kishi kelgan bo‘lsa) o‘quv kuni deb faraz qilish uchun.
    const arrivalsBySchoolDay = new Map<string, number>();
    for (const row of dayRows) {
      const key = `${row.date}:${Number(row.schoolId)}`;
      arrivalsBySchoolDay.set(
        key,
        (arrivalsBySchoolDay.get(key) ?? 0) + Number(row.present ?? 0),
      );
    }

    // 3. Kesim bo‘yicha yig‘amiz.
    const totals = emptyCounters();
    const groups = new Map<number, Counters>();

    for (const row of dayRows) {
      const total = Number(row.total);
      const present = Number(row.present ?? 0);
      const excused = Math.min(Number(row.excused ?? 0), total - present);
      const classId =
        isStudent && row.classId !== null ? Number(row.classId) : null;

      const { state } = assumeWorkDay(
        statesByDate
          .get(row.date)
          ?.get(
            attendanceCalendarKey(
              Number(row.schoolId),
              classId,
              !isStudent && Number(row.primaryOnly) === 1,
            ),
          ) ?? 'UNCONFIGURED',
        row.date,
        (arrivalsBySchoolDay.get(`${row.date}:${Number(row.schoolId)}`) ?? 0) >
          0,
      );

      const groupId = this.groupIdOf(level, row, classId);
      const group = groups.get(groupId) ?? emptyCounters();
      groups.set(groupId, group);

      for (const counters of [group, totals]) {
        counters.personDays += total;

        if (state === 'WORK_DAY') {
          counters.present += present;
          counters.excused += excused;
          counters.absent += total - present - excused;
          counters.expected += total;
          counters.attended += present + excused;
        } else if (state === 'DAY_OFF') {
          counters.dayOff += total;
        } else {
          // Kalendar sozlanmagan: kelganlar hisoblanadi, kelmaganlar
          // «aniqlanmagan» — ularni sababsiz deb bo‘lmaydi.
          counters.present += present;
          counters.unknown += total - present;
        }
      }
    }

    // 4. Takrorlanmas shaxslar soni (kishi-kun emas).
    const [personsByGroup, countedPersons, membersByGroup] = await Promise.all([
      this.countPersonsByGroup(query, user, membershipType, from, to, level),
      this.countPersons(query, user, membershipType, from, to),
      this.countMembersByGroup(query, user, membershipType, from, to, level),
    ]);

    // Davomat qatori yo‘q (masalan, terminal ma’lumot yubormagan) hudud,
    // maktab va sinflar ham ro‘yxatda 0 kelgan bilan ko‘rinadi.
    let totalPersons = countedPersons;

    for (const [groupId, members] of membersByGroup) {
      if (groups.has(groupId)) continue;

      groups.set(groupId, emptyCounters());
      personsByGroup.set(groupId, members);
      totalPersons += members;
    }

    const names = await this.loadNames(level, [...groups.keys()]);

    const items = [...groups.entries()]
      .map(([id, counters]) => {
        const label = names.get(id);

        return {
          id,
          name: label?.name ?? null,
          subtitle: label?.subtitle ?? null,
          gradeLevel: label?.gradeLevel ?? null,
          ...this.finish(counters, personsByGroup.get(id) ?? 0),
        };
      })
      .sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', 'uz', { numeric: true }),
      );

    return {
      level,
      membershipType,
      from,
      to,
      days: dates.length,
      generatedAt: new Date().toISOString(),
      bands: { lowBelow: BAND_LOW_BELOW, highAbove: BAND_HIGH_ABOVE },
      totals: this.finish(totals, totalPersons),
      items,
    };
  }

  /** Filtr va rolga qarab keyingi kesimni tanlaydi. */
  private resolveLevel(
    query: GetAttendanceSummaryQueryDto,
    user: AuthenticatedUser,
    isStudent: boolean,
  ): AttendanceSummaryLevel {
    if (
      query.classId !== undefined ||
      query.schoolId !== undefined ||
      user.role === UserRole.SCHOOL_ADMIN
    ) {
      return isStudent ? 'CLASS' : 'SCHOOL';
    }

    if (
      query.districtId !== undefined ||
      user.role === UserRole.DISTRICT_ADMIN
    ) {
      return 'SCHOOL';
    }

    if (query.regionId !== undefined || user.role === UserRole.REGION_ADMIN) {
      return 'DISTRICT';
    }

    return 'REGION';
  }

  private groupIdOf(
    level: AttendanceSummaryLevel,
    row: DayRow,
    classId: number | null,
  ): number {
    switch (level) {
      case 'REGION':
        return Number(row.regionId);
      case 'DISTRICT':
        return Number(row.districtId);
      case 'SCHOOL':
        return Number(row.schoolId);
      case 'CLASS':
        return classId ?? NO_CLASS_ID;
    }
  }

  private finish(counters: Counters, persons: number) {
    const rate =
      counters.expected > 0
        ? Math.round((counters.attended / counters.expected) * 1000) / 10
        : null;

    return {
      persons,
      personDays: counters.personDays,
      present: counters.present,
      absent: counters.absent,
      excused: counters.excused,
      dayOff: counters.dayOff,
      unknown: counters.unknown,
      expected: counters.expected,
      rate,
      band: bandOf(rate),
    };
  }

  /**
   * Umumiy so‘rov: davr, tur, vakolat va hudud filtrlari.
   * `withClass` — o‘quvchining shu davrdagi sinfini qo‘shadi
   * (`cls.classId`). Sinf bir marta guruhlangan jadvaldan olinadi,
   * har bir qator uchun alohida so‘rov yuborilmaydi.
   */
  private baseQuery(
    query: GetAttendanceSummaryQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
    from: string,
    to: string,
    withClass: boolean,
    withBand = false,
  ): SelectQueryBuilder<DailyAttendance> {
    const builder = this.dataSource
      .createQueryBuilder()
      .from(DailyAttendance, 'daily')
      .where('daily.date >= :from', { from })
      .andWhere('daily.date <= :to', { to })
      .andWhere('daily.membershipType = :membershipType', { membershipType });

    const dailyColumns: PlaceColumns = {
      region: 'daily.regionId',
      district: 'daily.districtId',
      school: 'daily.schoolId',
    };

    this.applyScope(builder, user, dailyColumns);
    this.applyFilters(builder, query, dailyColumns);

    if (withClass || withBand) {
      builder.leftJoin(
        (sub) => {
          sub
            .from(SchoolMembership, 'sm')
            .innerJoin(Person, 'smPerson', 'smPerson.id = sm.personId')
            .innerJoin(School, 'smSchool', 'smSchool.id = sm.schoolId')
            .innerJoin(
              District,
              'smDistrict',
              'smDistrict.id = smSchool.districtId',
            )
            .select('smPerson.pnfl', 'pnfl')
            .addSelect('sm.schoolId', 'schoolId')
            .addSelect('MAX(sm.classId)', 'classId')
            .addSelect('MAX(sm.primaryOnly)', 'primaryOnly')
            .where('sm.type = :membershipType')
            .andWhere('sm.startDate <= :to')
            .andWhere('(sm.endDate IS NULL OR sm.endDate > :from)')
            .groupBy('smPerson.pnfl')
            .addGroupBy('sm.schoolId');

          const membershipColumns: PlaceColumns = {
            region: 'smDistrict.regionId',
            district: 'smSchool.districtId',
            school: 'smSchool.id',
          };

          this.applyScope(sub, user, membershipColumns);
          this.applyFilters(sub, query, membershipColumns);

          return sub;
        },
        'cls',
        'cls.pnfl = daily.pnfl AND cls.schoolId = daily.schoolId',
      );

      if (withClass && query.classId !== undefined) {
        builder.andWhere('cls.classId = :filterClassId', {
          filterClassId: query.classId,
        });
      }
    }

    // Ichki so‘rov parametrlari ham asosiy so‘rovda bo‘lishi shart.
    builder.setParameters({ from, to, membershipType });

    return builder;
  }

  private applyScope<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    user: AuthenticatedUser,
    columns: PlaceColumns,
  ) {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return;

      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }
        builder.andWhere(`${columns.region} = :scopeRegionId`, {
          scopeRegionId: user.regionId,
        });
        return;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }
        builder.andWhere(`${columns.district} = :scopeDistrictId`, {
          scopeDistrictId: user.districtId,
        });
        return;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }
        builder.andWhere(`${columns.school} = :scopeSchoolId`, {
          scopeSchoolId: user.schoolId,
        });
        return;

      default:
        throw new ForbiddenException('Davomatni ko‘rishga ruxsat yo‘q');
    }
  }

  private applyFilters<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    query: GetAttendanceSummaryQueryDto,
    columns: PlaceColumns,
  ) {
    if (query.regionId !== undefined) {
      builder.andWhere(`${columns.region} = :filterRegionId`, {
        filterRegionId: query.regionId,
      });
    }

    if (query.districtId !== undefined) {
      builder.andWhere(`${columns.district} = :filterDistrictId`, {
        filterDistrictId: query.districtId,
      });
    }

    if (query.schoolId !== undefined) {
      builder.andWhere(`${columns.school} = :filterSchoolId`, {
        filterSchoolId: query.schoolId,
      });
    }
  }

  private async countPersonsByGroup(
    query: GetAttendanceSummaryQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
    from: string,
    to: string,
    level: AttendanceSummaryLevel,
  ): Promise<Map<number, number>> {
    const isStudent = membershipType === MembershipType.STUDENT;
    const withClass =
      isStudent && (level === 'CLASS' || query.classId !== undefined);

    const groupExpression = {
      REGION: 'daily.regionId',
      DISTRICT: 'daily.districtId',
      SCHOOL: 'daily.schoolId',
      CLASS: `COALESCE(cls.classId, ${NO_CLASS_ID})`,
    }[level];

    const rows = await this.baseQuery(
      query,
      user,
      membershipType,
      from,
      to,
      withClass,
    )
      .select(groupExpression, 'groupId')
      .addSelect('COUNT(DISTINCT daily.pnfl)', 'persons')
      .groupBy(groupExpression)
      .getRawMany<{ groupId: number | string; persons: number | string }>();

    return new Map(
      rows.map((row) => [Number(row.groupId), Number(row.persons)]),
    );
  }

  /**
   * Shu davrda faol a’zolik bo‘yicha shaxslar soni (davomat qatori
   * bo‘lishi shart emas). Davomat qatori yo‘q guruhlarni topish uchun.
   */
  private async countMembersByGroup(
    query: GetAttendanceSummaryQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
    from: string,
    to: string,
    level: AttendanceSummaryLevel,
  ): Promise<Map<number, number>> {
    const isStudent = membershipType === MembershipType.STUDENT;

    const builder = this.dataSource
      .createQueryBuilder()
      .from(SchoolMembership, 'sm')
      .innerJoin(Person, 'smPerson', 'smPerson.id = sm.personId')
      .innerJoin(School, 'smSchool', 'smSchool.id = sm.schoolId')
      .innerJoin(District, 'smDistrict', 'smDistrict.id = smSchool.districtId')
      .where('sm.type = :membershipType')
      .andWhere('sm.startDate <= :to')
      .andWhere('(sm.endDate IS NULL OR sm.endDate > :from)')
      .setParameters({ from, to, membershipType });

    const columns: PlaceColumns = {
      region: 'smDistrict.regionId',
      district: 'smSchool.districtId',
      school: 'smSchool.id',
    };

    this.applyScope(builder, user, columns);
    this.applyFilters(builder, query, columns);

    if (isStudent && query.classId !== undefined) {
      builder.andWhere('sm.classId = :filterClassId', {
        filterClassId: query.classId,
      });
    }

    const groupExpression = {
      REGION: 'smDistrict.regionId',
      DISTRICT: 'smSchool.districtId',
      SCHOOL: 'smSchool.id',
      CLASS: `COALESCE(sm.classId, ${NO_CLASS_ID})`,
    }[level];

    const rows = await builder
      .select(groupExpression, 'groupId')
      .addSelect('COUNT(DISTINCT smPerson.pnfl)', 'persons')
      .groupBy(groupExpression)
      .getRawMany<{ groupId: number | string; persons: number | string }>();

    return new Map(
      rows.map((row) => [Number(row.groupId), Number(row.persons)]),
    );
  }

  private async countPersons(
    query: GetAttendanceSummaryQueryDto,
    user: AuthenticatedUser,
    membershipType: MembershipType,
    from: string,
    to: string,
  ): Promise<number> {
    const withClass =
      membershipType === MembershipType.STUDENT && query.classId !== undefined;

    const row = await this.baseQuery(
      query,
      user,
      membershipType,
      from,
      to,
      withClass,
    )
      .select('COUNT(DISTINCT daily.schoolId, daily.pnfl)', 'persons')
      .getRawOne<{ persons: number | string }>();

    return Number(row?.persons ?? 0);
  }

  private async loadNames(
    level: AttendanceSummaryLevel,
    ids: number[],
  ): Promise<
    Map<
      number,
      { name: string; subtitle: string | null; gradeLevel: number | null }
    >
  > {
    const result = new Map<
      number,
      { name: string; subtitle: string | null; gradeLevel: number | null }
    >();
    const realIds = ids.filter((id) => id !== NO_CLASS_ID);

    if (realIds.length === 0) {
      return result;
    }

    switch (level) {
      case 'REGION': {
        const regions = await this.dataSource
          .getRepository(Region)
          .find({ where: { id: In(realIds) } });

        for (const region of regions) {
          result.set(region.id, {
            name: region.name,
            subtitle: null,
            gradeLevel: null,
          });
        }
        break;
      }

      case 'DISTRICT': {
        const districts = await this.dataSource.getRepository(District).find({
          where: { id: In(realIds) },
          relations: { region: true },
        });

        for (const district of districts) {
          result.set(district.id, {
            name: district.name,
            subtitle: district.region?.name ?? null,
            gradeLevel: null,
          });
        }
        break;
      }

      case 'SCHOOL': {
        const schools = await this.dataSource.getRepository(School).find({
          where: { id: In(realIds) },
          relations: { district: true },
        });

        for (const school of schools) {
          result.set(school.id, {
            name: school.name,
            subtitle: school.district?.name ?? null,
            gradeLevel: null,
          });
        }
        break;
      }

      case 'CLASS': {
        const classes = await this.dataSource
          .getRepository(SchoolClass)
          .find({ where: { id: In(realIds) } });

        for (const schoolClass of classes) {
          result.set(schoolClass.id, {
            name: schoolClass.name,
            subtitle: schoolClass.academicYear,
            gradeLevel: schoolClass.gradeLevel,
          });
        }
        break;
      }
    }

    return result;
  }
}
