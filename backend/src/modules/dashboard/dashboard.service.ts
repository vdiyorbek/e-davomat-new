import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { assertSchoolAccess } from '../classes/school-access';
import {
  healthSqlParams,
  healthStatusSql,
} from '../terminals/terminal-health.rules';
import { Terminal } from '../terminals/terminal.entity';
import {
  addDays,
  sqlDate,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import { UserRole } from '../users/enums/user-role.enum';
import { DashboardStatsQueue } from './dashboard-stats.queue';
import { DashboardStatsRefresher } from './dashboard-stats.refresher';
import { attendanceRate } from './stats-rules';
import type {
  DashboardDayDto,
  DashboardScopeDto,
  DashboardStreaksDto,
  DashboardTrendDto,
} from './dto/dashboard-query.dto';

export type DashboardLevel = 'COUNTRY' | 'REGION' | 'DISTRICT' | 'SCHOOL';

export interface DashboardScope {
  level: DashboardLevel;
  region: { id: number; name: string; geoKey: string | null } | null;
  district: { id: number; name: string; geoKey: string | null } | null;
  school: { id: number; name: string } | null;
}

const MAX_TREND_DAYS = 92;
const SUM_COLUMNS = [
  'members',
  'expected',
  'present',
  'excused',
  'absent',
  'late',
  'lateEvaluated',
  'inside',
  'dayOff',
  'unknown',
  'assumedWorkDay',
  'noData',
  'shift1Expected',
  'shift1Present',
  'shift1Excused',
  'shift1Late',
  'shift2Expected',
  'shift2Present',
  'shift2Excused',
  'shift2Late',
] as const;

type Totals = Record<(typeof SUM_COLUMNS)[number], number>;

const sumSelect = (alias: string) =>
  SUM_COLUMNS.map((c) => `COALESCE(SUM(${alias}.${c}), 0) AS ${c}`).join(', ');

function toTotals(row: Record<string, unknown> | undefined): Totals {
  const result = {} as Totals;
  for (const c of SUM_COLUMNS) result[c] = Number(row?.[c] ?? 0);
  return result;
}

function kpi(t: Totals) {
  return {
    ...t,
    rate: attendanceRate(t.expected, t.present, t.excused),
    lateRate:
      t.present > 0 ? Math.round((t.late / t.present) * 1000) / 10 : null,
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: DashboardStatsQueue,
    private readonly refresher: DashboardStatsRefresher,
  ) {}

  // ─────────────── Doira (rol + tanlangan hudud) ───────────────

  async resolveScope(
    user: AuthenticatedUser,
    query: DashboardScopeDto,
  ): Promise<DashboardScope> {
    let { regionId, districtId, schoolId } = query;

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;
      case UserRole.REGION_ADMIN:
        if (!user.regionId)
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        if (regionId !== undefined && regionId !== user.regionId) {
          throw new ForbiddenException(
            'Boshqa viloyat ma’lumotiga ruxsat yo‘q',
          );
        }
        regionId = user.regionId;
        break;
      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId)
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        if (districtId !== undefined && districtId !== user.districtId) {
          throw new ForbiddenException('Boshqa tuman ma’lumotiga ruxsat yo‘q');
        }
        districtId = user.districtId;
        regionId = undefined;
        break;
      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId)
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        if (schoolId !== undefined && schoolId !== user.schoolId) {
          throw new ForbiddenException('Boshqa maktab ma’lumotiga ruxsat yo‘q');
        }
        schoolId = user.schoolId;
        districtId = undefined;
        regionId = undefined;
        break;
      default:
        throw new ForbiddenException('Dashboard faqat administratorlar uchun');
    }

    const scope: DashboardScope = {
      level: 'COUNTRY',
      region: null,
      district: null,
      school: null,
    };

    if (schoolId !== undefined) {
      const [row]: { id: number; name: string; districtId: number }[] =
        await this.dataSource.query(
          'SELECT id, name, districtId FROM schools WHERE id = ?',
          [schoolId],
        );
      if (!row) throw new NotFoundException('Maktab topilmadi');
      if (districtId !== undefined && Number(row.districtId) !== districtId) {
        throw new ForbiddenException('Maktab bu tumanga tegishli emas');
      }
      scope.school = { id: Number(row.id), name: row.name };
      districtId = Number(row.districtId);
      scope.level = 'SCHOOL';
    }

    if (districtId !== undefined) {
      const [row]: {
        id: number;
        name: string;
        regionId: number;
        geoKey: string | null;
      }[] = await this.dataSource.query(
        'SELECT id, name, regionId, geoKey FROM districts WHERE id = ?',
        [districtId],
      );
      if (!row) throw new NotFoundException('Tuman topilmadi');
      if (regionId !== undefined && Number(row.regionId) !== regionId) {
        throw new ForbiddenException('Tuman bu viloyatga tegishli emas');
      }
      scope.district = {
        id: Number(row.id),
        name: row.name,
        geoKey: row.geoKey,
      };
      regionId = Number(row.regionId);
      if (scope.level === 'COUNTRY') scope.level = 'DISTRICT';
    }

    if (regionId !== undefined) {
      const [row]: { id: number; name: string; geoKey: string | null }[] =
        await this.dataSource.query(
          'SELECT id, name, geoKey FROM regions WHERE id = ?',
          [regionId],
        );
      if (!row) throw new NotFoundException('Viloyat topilmadi');
      scope.region = { id: Number(row.id), name: row.name, geoKey: row.geoKey };
      if (scope.level === 'COUNTRY') scope.level = 'REGION';
    }

    // Rol doirasidan tashqariga chiqmaslik (masalan, tuman admini boshqa viloyatga).
    if (
      user.role === UserRole.REGION_ADMIN &&
      scope.region?.id !== user.regionId
    ) {
      throw new ForbiddenException('Boshqa viloyat ma’lumotiga ruxsat yo‘q');
    }

    return scope;
  }

  /** `school_daily_stats` (alias) uchun doira sharti. */
  private scopeWhere(
    scope: DashboardScope,
    alias: string,
  ): { sql: string; params: number[] } {
    if (scope.school)
      return { sql: `${alias}.schoolId = ?`, params: [scope.school.id] };
    if (scope.district)
      return { sql: `${alias}.districtId = ?`, params: [scope.district.id] };
    if (scope.region)
      return { sql: `${alias}.regionId = ?`, params: [scope.region.id] };
    return { sql: '1 = 1', params: [] };
  }

  private checkDate(date: string | undefined): string {
    const today = todayInTashkent();
    const value = date ?? today;
    if (value > today)
      throw new BadRequestException('Kelajakdagi sana uchun statistika yo‘q');
    return value;
  }

  private async totals(scope: DashboardScope, date: string) {
    const where = this.scopeWhere(scope, 's');
    const rows: (Record<string, unknown> & { membershipType: string })[] =
      await this.dataSource.query(
        `SELECT s.membershipType, ${sumSelect('s')}
         FROM school_daily_stats s
        WHERE s.date = ? AND ${where.sql}
        GROUP BY s.membershipType`,
        [date, ...where.params],
      );
    return {
      students: toTotals(rows.find((r) => r.membershipType === 'STUDENT')),
      teachers: toTotals(rows.find((r) => r.membershipType === 'TEACHER')),
    };
  }

  // ─────────────── Umumiy ko‘rinish ───────────────

  async overview(user: AuthenticatedUser, query: DashboardDayDto) {
    const scope = await this.resolveScope(user, query);
    const date = this.checkDate(query.date);
    const where = this.scopeWhere(scope, 's');

    const current = await this.totals(scope, date);

    // Taqqoslash: oxirgi 10 kun ichidagi oldingi o‘quv kuni.
    const [previousRow]: { date: string | Date | null }[] =
      await this.dataSource.query(
        `SELECT MAX(s.date) AS date FROM school_daily_stats s
        WHERE s.date < ? AND s.date >= ? AND s.membershipType = 'STUDENT'
          AND s.expected > 0 AND ${where.sql}`,
        [date, addDays(date, -10), ...where.params],
      );
    const previousDate = previousRow?.date ? sqlDate(previousRow.date) : null;
    const previous = previousDate
      ? await this.totals(scope, previousDate)
      : null;

    const [schoolInfo]: {
      schools: number;
      withoutData: number;
      assumed: number;
      computedAt: Date | null;
    }[] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT s.schoolId) AS schools,
                COUNT(DISTINCT CASE WHEN s.noData > 0 THEN s.schoolId END) AS withoutData,
                COUNT(DISTINCT CASE WHEN s.assumedWorkDay > 0 THEN s.schoolId END) AS assumed,
                MAX(s.computedAt) AS computedAt
           FROM school_daily_stats s
          WHERE s.date = ? AND s.membershipType = 'STUDENT' AND ${where.sql}`,
      [date, ...where.params],
    );

    const s = current.students;

    return {
      scope,
      date,
      previousDate,
      computedAt: schoolInfo?.computedAt ?? null,
      students: kpi(current.students),
      teachers: kpi(current.teachers),
      previous: previous
        ? { students: kpi(previous.students), teachers: kpi(previous.teachers) }
        : null,
      shifts: [1, 2].map((code) => {
        const expected = code === 1 ? s.shift1Expected : s.shift2Expected;
        const present = code === 1 ? s.shift1Present : s.shift2Present;
        const excused = code === 1 ? s.shift1Excused : s.shift2Excused;
        const late = code === 1 ? s.shift1Late : s.shift2Late;
        return {
          code,
          expected,
          present,
          excused,
          late,
          rate: attendanceRate(expected, present, excused),
        };
      }),
      schools: {
        total: Number(schoolInfo?.schools ?? 0),
        withoutData: Number(schoolInfo?.withoutData ?? 0),
        calendarAssumed: Number(schoolInfo?.assumed ?? 0),
      },
      terminals: await this.terminalHealth(scope),
      children: await this.children(scope, date),
      lateThreshold: scope.school
        ? await this.lateSettings(scope.school.id)
        : null,
    };
  }

  /** Keyingi bosqich birliklari: viloyatlar / tumanlar / maktablar / sinflar. */
  private async children(scope: DashboardScope, date: string) {
    if (scope.level === 'SCHOOL')
      return this.classChildren(scope.school!.id, date);

    const unit =
      scope.level === 'COUNTRY'
        ? {
            table: 'regions',
            key: 'regionId',
            filter: '',
            params: [] as number[],
            extra: 'u.geoKey',
          }
        : scope.level === 'REGION'
          ? {
              table: 'districts',
              key: 'districtId',
              filter: 'WHERE u.regionId = ?',
              params: [scope.region!.id],
              extra: 'u.geoKey',
            }
          : {
              table: 'schools',
              key: 'schoolId',
              filter: 'WHERE u.districtId = ?',
              params: [scope.district!.id],
              extra: 'NULL',
            };
    // Maktab darajasida — xaritada nuqta sifatida ko‘rsatish uchun lokatsiya.
    const coordinates =
      scope.level === 'DISTRICT'
        ? 'u.latitude AS latitude, u.longitude AS longitude'
        : 'NULL AS latitude, NULL AS longitude';

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT u.id, u.name, ${unit.extra} AS geoKey, ${coordinates},
              st.expected, st.present, st.excused, st.absent, st.late, st.members,
              st.schools, st.withoutData,
              te.expected AS tExpected, te.present AS tPresent, te.excused AS tExcused, te.late AS tLate
         FROM ${unit.table} u
         LEFT JOIN (
           SELECT s.${unit.key} AS unitId, SUM(s.expected) expected, SUM(s.present) present,
                  SUM(s.excused) excused, SUM(s.absent) absent, SUM(s.late) late, SUM(s.members) members,
                  COUNT(*) schools,
                  SUM(s.noData > 0) withoutData
             FROM school_daily_stats s
            WHERE s.date = ? AND s.membershipType = 'STUDENT'
            GROUP BY s.${unit.key}
         ) st ON st.unitId = u.id
         LEFT JOIN (
           SELECT s.${unit.key} AS unitId, SUM(s.expected) expected, SUM(s.present) present,
                  SUM(s.excused) excused, SUM(s.late) late
             FROM school_daily_stats s
            WHERE s.date = ? AND s.membershipType = 'TEACHER'
            GROUP BY s.${unit.key}
         ) te ON te.unitId = u.id
         ${unit.filter}
         ORDER BY u.name`,
      [date, date, ...unit.params],
    );

    const thresholds =
      scope.level === 'DISTRICT'
        ? await this.schoolThresholds(rows.map((r) => Number(r.id)))
        : null;

    return rows.map((row) => {
      const n = (key: string) => Number(row[key] ?? 0);
      return {
        id: Number(row.id),
        name: String(row.name),
        geoKey: (row.geoKey as string | null) ?? null,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        schools: n('schools'),
        schoolsWithoutData: n('withoutData'),
        students: {
          members: n('members'),
          expected: n('expected'),
          present: n('present'),
          excused: n('excused'),
          absent: n('absent'),
          late: n('late'),
          rate: attendanceRate(n('expected'), n('present'), n('excused')),
        },
        teachers: {
          expected: n('tExpected'),
          present: n('tPresent'),
          late: n('tLate'),
          rate: attendanceRate(n('tExpected'), n('tPresent'), n('tExcused')),
        },
        lateThreshold: thresholds?.get(Number(row.id)) ?? null,
      };
    });
  }

  /** Maktab darajasida — sinflar kesimi (issiqlik jadvali uchun). */
  private async classChildren(schoolId: number, date: string) {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT c.id, c.name, c.gradeLevel, cd.state, cd.expected, cd.present, cd.excused, cd.absent, cd.late,
              ss.code AS shiftCode
         FROM class_day_states cd
         JOIN school_classes c ON c.id = cd.classId
         LEFT JOIN school_class_shifts cs ON cs.classId = c.id AND cs.startDate <= ?
              AND (cs.endDate IS NULL OR cs.endDate > ?)
         LEFT JOIN school_shifts ss ON ss.id = cs.shiftId
        WHERE cd.schoolId = ? AND cd.date = ?
        ORDER BY c.gradeLevel, c.name`,
      [date, date, schoolId, date],
    );

    return rows.map((row) => {
      const n = (key: string) => Number(row[key] ?? 0);
      return {
        id: Number(row.id),
        name: String(row.name),
        geoKey: null,
        gradeLevel: row.gradeLevel === null ? null : Number(row.gradeLevel),
        shiftCode: row.shiftCode === null ? null : Number(row.shiftCode),
        dayState: String(row.state),
        schools: 0,
        schoolsWithoutData: 0,
        students: {
          members: n('expected'),
          expected: n('expected'),
          present: n('present'),
          excused: n('excused'),
          absent: n('absent'),
          late: n('late'),
          rate: attendanceRate(n('expected'), n('present'), n('excused')),
        },
        teachers: null,
        lateThreshold: null,
      };
    });
  }

  private async terminalHealth(scope: DashboardScope) {
    const builder = this.dataSource
      .getRepository(Terminal)
      .createQueryBuilder('terminal')
      .innerJoin('terminal.school', 'school')
      .innerJoin('school.district', 'district')
      .select(healthStatusSql('terminal'), 'status')
      .addSelect('terminal.eventSource', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('terminal.archivedAt IS NULL')
      .setParameters(healthSqlParams())
      .groupBy('status')
      .addGroupBy('source');

    if (scope.school)
      builder.andWhere('terminal.schoolId = :sid', { sid: scope.school.id });
    else if (scope.district)
      builder.andWhere('school.districtId = :did', { did: scope.district.id });
    else if (scope.region)
      builder.andWhere('district.regionId = :rid', { rid: scope.region.id });

    const rows = await builder.getRawMany<{
      status: string;
      source: string;
      count: string;
    }>();
    const result = {
      total: 0,
      online: 0,
      offline: 0,
      unknown: 0,
      disabled: 0,
      push: 0,
      polling: 0,
    };
    for (const row of rows) {
      const count = Number(row.count);
      result.total += count;
      if (row.status === 'ONLINE') result.online += count;
      else if (row.status === 'OFFLINE') result.offline += count;
      else if (row.status === 'DISABLED') result.disabled += count;
      else result.unknown += count;
      if (row.source === 'PUSH') result.push += count;
      else result.polling += count;
    }
    return result;
  }

  // ─────────────── Dinamika va kelish vaqti ───────────────

  async trend(user: AuthenticatedUser, query: DashboardTrendDto) {
    const scope = await this.resolveScope(user, query);
    const to = this.checkDate(query.to);
    const from = query.from ?? addDays(to, -29);
    if (from > to || addDays(from, MAX_TREND_DAYS - 1) < to) {
      throw new BadRequestException(
        `Davr 1–${MAX_TREND_DAYS} kun bo‘lishi kerak`,
      );
    }

    const where = this.scopeWhere(scope, 's');
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT DATE_FORMAT(s.date, '%Y-%m-%d') AS date, s.membershipType,
              SUM(s.expected) expected, SUM(s.present) present, SUM(s.excused) excused, SUM(s.late) late
         FROM school_daily_stats s
        WHERE s.date BETWEEN ? AND ? AND ${where.sql}
        GROUP BY s.date, s.membershipType
        ORDER BY s.date`,
      [from, to, ...where.params],
    );

    const byDate = new Map<
      string,
      { date: string; students: unknown; teachers: unknown }
    >();
    for (const row of rows) {
      const date = String(row.date);
      const entry = byDate.get(date) ?? {
        date,
        students: null,
        teachers: null,
      };
      const point = {
        expected: Number(row.expected),
        present: Number(row.present),
        excused: Number(row.excused),
        late: Number(row.late),
        rate: attendanceRate(
          Number(row.expected),
          Number(row.present),
          Number(row.excused),
        ),
      };
      if (row.membershipType === 'STUDENT') entry.students = point;
      else entry.teachers = point;
      byDate.set(date, entry);
    }

    return { scope, from, to, points: [...byDate.values()] };
  }

  /** Kelish vaqti taqsimoti (10 daqiqalik oraliqlar, Toshkent vaqti). */
  async arrivals(user: AuthenticatedUser, query: DashboardDayDto) {
    const scope = await this.resolveScope(user, query);
    const date = this.checkDate(query.date);
    const where = this.scopeWhere(scope, 'd');

    const rows: { membershipType: string; bucket: number; count: number }[] =
      await this.dataSource.query(
        `SELECT d.membershipType,
              FLOOR(MOD(HOUR(d.firstInTime) * 60 + MINUTE(d.firstInTime) + 300, 1440) / 10) AS bucket,
              COUNT(*) AS count
         FROM daily_attendance d
        WHERE d.date = ? AND d.firstInTime IS NOT NULL AND ${where.sql}
        GROUP BY d.membershipType, bucket`,
        [date, ...where.params],
      );

    const shiftWhere = this.scopeWhere(scope, 'x');
    const shifts: { code: number; startTime: string; schools: number }[] =
      await this.dataSource.query(
        `SELECT ss.code, TIME_FORMAT(ss.startTime, '%H:%i') AS startTime, COUNT(DISTINCT ss.schoolId) AS schools
         FROM school_shifts ss
         JOIN (SELECT s.id AS schoolId, s.districtId, d.regionId
                 FROM schools s JOIN districts d ON d.id = s.districtId) x ON x.schoolId = ss.schoolId
        WHERE ss.isActive = 1 AND ${shiftWhere.sql}
        GROUP BY ss.code, startTime
        ORDER BY schools DESC
        LIMIT 4`,
        shiftWhere.params,
      );

    return {
      scope,
      date,
      bucketMinutes: 10,
      buckets: rows.map((r) => ({
        type: r.membershipType,
        minute: Number(r.bucket) * 10,
        count: Number(r.count),
      })),
      shifts: shifts.map((s) => ({
        code: Number(s.code),
        startTime: s.startTime,
        schools: Number(s.schools),
      })),
    };
  }

  // ─────────────── Ketma-ket kelmaganlar ───────────────

  async streaks(user: AuthenticatedUser, query: DashboardStreaksDto) {
    const scope = await this.resolveScope(user, query);
    const date = this.checkDate(query.date);
    const where = this.scopeWhere(scope, 'x');

    const joins = `FROM absence_streaks a
         JOIN (SELECT s.id AS schoolId, s.name AS schoolName, s.districtId, d.regionId, d.name AS districtName
                 FROM schools s JOIN districts d ON d.id = s.districtId) x ON x.schoolId = a.schoolId
         JOIN persons p ON p.id = a.personId`;
    let filter = `WHERE a.date = ? AND ${where.sql}`;
    const extra: unknown[] = [];
    const search = query.search?.trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      filter += ` AND (CONCAT_WS(' ', p.lastName, p.firstName, p.middleName) LIKE ? OR CONCAT_WS(' ', p.firstName, p.lastName) LIKE ?)`;
      extra.push(like, like);
    }
    if (query.minDays) {
      filter += ` AND a.days >= ?`;
      extra.push(query.minDays);
    }

    const [count]: { total: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total ${joins} ${filter}`,
      [date, ...where.params, ...extra],
    );

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT a.personId, p.firstName, p.lastName, p.middleName, a.days, a.sinceDate,
              a.schoolId, x.schoolName, x.districtName, c.name AS className, m.name AS mahallaName
         ${joins}
         JOIN school_classes c ON c.id = a.classId
         LEFT JOIN mahallas m ON m.id = p.mahallaId
         ${filter}
        ORDER BY a.days DESC, p.lastName, p.firstName
        LIMIT ? OFFSET ?`,
      [date, ...where.params, ...extra, query.limit, (query.page - 1) * query.limit],
    );

    const total = Number(count?.total ?? 0);
    return {
      date,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      data: rows.map((row) => ({
        personId: Number(row.personId),
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName,
        days: Number(row.days),
        sinceDate: sqlDate(row.sinceDate as string | Date),
        school: {
          id: Number(row.schoolId),
          name: row.schoolName,
          district: row.districtName,
        },
        className: row.className,
        mahalla: row.mahallaName ?? null,
      })),
    };
  }

  // ─────────────── Kechikish chegarasi ───────────────

  private async schoolThresholds(schoolIds: number[]) {
    const result = new Map<
      number,
      Awaited<ReturnType<DashboardService['lateSettings']>>
    >();
    if (schoolIds.length === 0) return result;
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT s.id, s.lateThresholdMinutes, s.lateThresholdUpdatedAt, u.login, u.firstName, u.lastName, u.role
         FROM schools s LEFT JOIN users u ON u.id = s.lateThresholdUpdatedByUserId
        WHERE s.id IN (${schoolIds.map(() => '?').join(',')})`,
      schoolIds,
    );
    for (const row of rows)
      result.set(Number(row.id), this.toLateSettings(row));
    return result;
  }

  private toLateSettings(row: Record<string, unknown>) {
    return {
      minutes: Number(row.lateThresholdMinutes),
      updatedAt: (row.lateThresholdUpdatedAt as Date | null) ?? null,
      updatedBy: row.login
        ? {
            login: String(row.login),
            name:
              [row.lastName, row.firstName].filter(Boolean).join(' ') || null,
            role: String(row.role),
          }
        : null,
    };
  }

  async lateSettings(schoolId: number) {
    const [row]: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT s.lateThresholdMinutes, s.lateThresholdUpdatedAt, u.login, u.firstName, u.lastName, u.role
         FROM schools s LEFT JOIN users u ON u.id = s.lateThresholdUpdatedByUserId
        WHERE s.id = ?`,
      [schoolId],
    );
    if (!row) throw new NotFoundException('Maktab topilmadi');
    return this.toLateSettings(row);
  }

  private async loadSchoolForAccess(schoolId: number, user: AuthenticatedUser) {
    const [row]: { id: number; districtId: number; regionId: number }[] =
      await this.dataSource.query(
        'SELECT s.id, s.districtId, d.regionId FROM schools s JOIN districts d ON d.id = s.districtId WHERE s.id = ?',
        [schoolId],
      );
    if (!row) throw new NotFoundException('Maktab topilmadi');
    assertSchoolAccess(user, {
      id: Number(row.id),
      districtId: Number(row.districtId),
      district: { regionId: Number(row.regionId) },
    });
  }

  async getLateSettings(user: AuthenticatedUser, schoolId: number) {
    await this.loadSchoolForAccess(schoolId, user);
    return this.lateSettings(schoolId);
  }

  /** Maktab o‘zi belgilaydi; yuqori adminlar ham kerak bo‘lsa o‘zgartira oladi. */
  async updateLateSettings(
    user: AuthenticatedUser,
    schoolId: number,
    minutes: number,
  ) {
    await this.loadSchoolForAccess(schoolId, user);
    await this.dataSource.query(
      `UPDATE schools SET lateThresholdMinutes = ?, lateThresholdUpdatedAt = NOW(3),
              lateThresholdUpdatedByUserId = ? WHERE id = ?`,
      [minutes, user.id, schoolId],
    );
    // Bugungi kechikishlar yangi chegara bilan qayta hisoblansin.
    await this.queue.mark([{ schoolId, date: todayInTashkent() }], 1_000);
    return this.lateSettings(schoolId);
  }

  // ─────────────── Xarita va tarixni to‘ldirish (super admin) ───────────────

  async geoUnits() {
    const [regions, districts] = await Promise.all([
      this.dataSource.query(
        'SELECT id, name, geoKey FROM regions ORDER BY name',
      ),
      this.dataSource.query(
        'SELECT id, name, regionId, geoKey FROM districts ORDER BY name',
      ),
    ]);
    return { regions, districts };
  }

  async updateGeoKey(
    level: 'REGION' | 'DISTRICT',
    id: number,
    geoKey: string | null,
  ) {
    const table = level === 'REGION' ? 'regions' : 'districts';
    if (level === 'REGION' && geoKey && !/^UZ-[A-Z]{2}$/.test(geoKey)) {
      throw new BadRequestException(
        'Viloyat kodi UZ-XX ko‘rinishida bo‘lishi kerak',
      );
    }
    // Bitta xarita hududi faqat bitta yozuvga bog‘lanadi.
    if (geoKey)
      await this.dataSource.query(
        `UPDATE ${table} SET geoKey = NULL WHERE geoKey = ?`,
        [geoKey],
      );
    const result: { affectedRows?: number } = await this.dataSource.query(
      `UPDATE ${table} SET geoKey = ? WHERE id = ?`,
      [geoKey, id],
    );
    if (!result.affectedRows) throw new NotFoundException('Hudud topilmadi');
    return { level, id, geoKey };
  }

  async backfill(from: string, to: string) {
    const today = todayInTashkent();
    const end = to > today ? today : to;
    if (from > end || addDays(from, 61) < end) {
      throw new BadRequestException('Davr 1–62 kun bo‘lishi kerak');
    }
    const dates: string[] = [];
    for (let d = from; d <= end; d = addDays(d, 1)) dates.push(d);
    const queued = await this.refresher.markAllSchools(dates, 60_000);
    return { from, to: end, days: dates.length, queued };
  }
}
