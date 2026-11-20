import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  CalendarResolverService,
  attendanceCalendarKey,
} from '../attendance-calendar/calendar-resolver.service';
import { MembershipType } from '../school-memberships/school-membership.entity';
import {
  addDays,
  sqlDate,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import {
  ABSENCE_STREAK_DAYS,
  absenceStreak,
  effectiveState,
  isLate,
  type EffectiveDayState,
} from './stats-rules';

interface Member {
  personId: number;
  pnfl: string;
  classId: number | null;
  membershipId: number;
  /** O‘qituvchi faqat boshlang‘ich sinflarda dars beradi (standart hafta 5 kun). */
  primaryOnly: boolean;
}

interface Counters {
  members: number;
  expected: number;
  present: number;
  excused: number;
  absent: number;
  late: number;
  lateEvaluated: number;
  inside: number;
  dayOff: number;
  unknown: number;
  assumedWorkDay: number;
  noData: number;
  shift1Expected: number;
  shift1Present: number;
  shift1Excused: number;
  shift1Late: number;
  shift2Expected: number;
  shift2Present: number;
  shift2Excused: number;
  shift2Late: number;
}

const emptyCounters = (): Counters => ({
  members: 0,
  expected: 0,
  present: 0,
  excused: 0,
  absent: 0,
  late: 0,
  lateEvaluated: 0,
  inside: 0,
  dayOff: 0,
  unknown: 0,
  assumedWorkDay: 0,
  noData: 0,
  shift1Expected: 0,
  shift1Present: 0,
  shift1Excused: 0,
  shift1Late: 0,
  shift2Expected: 0,
  shift2Present: 0,
  shift2Excused: 0,
  shift2Late: 0,
});

interface ClassDay {
  state: EffectiveDayState;
  expected: number;
  present: number;
  excused: number;
  absent: number;
  late: number;
}

/** Ketma-ketlikni topish uchun ortga qarab ko‘riladigan kunlar. */
const STREAK_LOOKBACK_DAYS = 45;

/**
 * Bitta maktabning bitta kuni uchun dashboard ko‘rsatkichlarini hisoblaydi
 * va `school_daily_stats`, `class_day_states`, `absence_streaks` ga yozadi.
 *
 * Hisob a’zoliklardan boshlanadi (daily_attendance qatorlari bo‘lmasa ham —
 * masalan, terminal butun kun ishlamagan maktab ham «0 kelgan» bilan chiqadi).
 */
@Injectable()
export class DashboardStatsBuilder {
  constructor(
    private readonly dataSource: DataSource,
    private readonly calendar: CalendarResolverService,
  ) {}

  async build(schoolId: number, date: string): Promise<void> {
    const today = todayInTashkent();
    if (date > today) return;

    const [school]: {
      id: number;
      districtId: number;
      regionId: number;
      lateThresholdMinutes: number;
    }[] = await this.dataSource.query(
      `SELECT s.id, s.districtId, d.regionId, s.lateThresholdMinutes
         FROM schools s JOIN districts d ON d.id = s.districtId
        WHERE s.id = ?`,
      [schoolId],
    );
    if (!school) return;

    const threshold = Number(school.lateThresholdMinutes);
    const students = await this.members(schoolId, date, MembershipType.STUDENT);
    const teachers = await this.members(schoolId, date, MembershipType.TEACHER);

    const daily: {
      pnfl: string;
      membershipType: MembershipType;
      firstInTime: Date | null;
      lastOutTime: Date | null;
    }[] = await this.dataSource.query(
      `SELECT pnfl, membershipType, firstInTime, lastOutTime
         FROM daily_attendance WHERE schoolId = ? AND date = ?`,
      [schoolId, date],
    );
    const dailyByKey = new Map(
      daily.map((row) => [`${row.membershipType}:${row.pnfl}`, row]),
    );
    const presentRow = (type: MembershipType, pnfl: string) => {
      const row = dailyByKey.get(`${type}:${pnfl}`);
      return row && (row.firstInTime || row.lastOutTime) ? row : null;
    };

    // Kamida bitta kishi kelgan bo‘lsa, shu kuni maktabdan ma’lumot bor.
    const hasData = daily.some((row) => row.firstInTime || row.lastOutTime);

    const excuses: { personId: number; membershipType: MembershipType }[] =
      await this.dataSource.query(
        `SELECT personId, membershipType FROM attendance_excuses
          WHERE schoolId = ? AND status = 'ACTIVE' AND startDate <= ? AND endDate >= ?`,
        [schoolId, date, date],
      );
    const excused = new Set(
      excuses.map((e) => `${e.membershipType}:${Number(e.personId)}`),
    );

    const classIds = [
      ...new Set(
        students
          .map((m) => m.classId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const [studentCalendar, teacherCalendar] = await Promise.all([
      this.calendar.resolveForAttendanceDay(
        date,
        MembershipType.STUDENT,
        classIds.map((classId) => ({ schoolId, classId })),
      ),
      // O‘qituvchi: umumiy hafta va «faqat 1–4 sinf» haftasi alohida hisoblanadi.
      this.calendar.resolveForAttendanceDay(date, MembershipType.TEACHER, [
        { schoolId, classId: null },
        { schoolId, classId: null, primaryOnly: true },
      ]),
    ]);

    const shifts = await this.classShifts(classIds, date);
    const firstLessons = await this.teacherFirstLessons(
      teachers.map((t) => t.membershipId),
      date,
    );

    // ── O‘quvchilar ──
    const studentCounters = emptyCounters();
    const classDays = new Map<number, ClassDay>();

    for (const member of students) {
      studentCounters.members++;
      if (member.classId === null) {
        studentCounters.unknown++;
        continue;
      }

      const calendarState =
        studentCalendar.get(attendanceCalendarKey(schoolId, member.classId)) ??
        'UNCONFIGURED';
      const { state, assumed } = effectiveState(calendarState, date, hasData);
      const classDay = classDays.get(member.classId) ?? {
        state,
        expected: 0,
        present: 0,
        excused: 0,
        absent: 0,
        late: 0,
      };
      classDays.set(member.classId, classDay);

      if (state === 'DAY_OFF') {
        studentCounters.dayOff++;
        continue;
      }
      // O‘quv kuni, lekin maktabdan hech qanday ma’lumot kelmagan (terminal
      // ishlamagan yoki kun hali boshlanmagan) — «kelmagan» emas, «noma’lum».
      if (state === 'UNKNOWN' || !hasData) {
        studentCounters.unknown++;
        if (state === 'WORK_DAY') studentCounters.noData++;
        continue;
      }
      if (assumed) studentCounters.assumedWorkDay++;

      const shift = shifts.get(member.classId) ?? null;
      const row = presentRow(MembershipType.STUDENT, member.pnfl);
      const isExcused = excused.has(`STUDENT:${member.personId}`);
      const late = row
        ? isLate(row.firstInTime, shift?.startTime ?? null, threshold)
        : null;

      studentCounters.expected++;
      classDay.expected++;
      if (shift?.code === 1) studentCounters.shift1Expected++;
      if (shift?.code === 2) studentCounters.shift2Expected++;

      if (row) {
        studentCounters.present++;
        classDay.present++;
        if (shift?.code === 1) studentCounters.shift1Present++;
        if (shift?.code === 2) studentCounters.shift2Present++;
        if (row.firstInTime && !row.lastOutTime) studentCounters.inside++;
        if (late !== null) studentCounters.lateEvaluated++;
        if (late) {
          studentCounters.late++;
          classDay.late++;
          if (shift?.code === 1) studentCounters.shift1Late++;
          if (shift?.code === 2) studentCounters.shift2Late++;
        }
      } else if (isExcused) {
        studentCounters.excused++;
        classDay.excused++;
        if (shift?.code === 1) studentCounters.shift1Excused++;
        if (shift?.code === 2) studentCounters.shift2Excused++;
      } else {
        studentCounters.absent++;
        classDay.absent++;
      }
    }

    // ── O‘qituvchilar ──
    const teacherCounters = emptyCounters();
    const teacherStateOf = (primaryOnly: boolean) =>
      effectiveState(
        teacherCalendar.get(
          attendanceCalendarKey(schoolId, null, primaryOnly),
        ) ?? 'UNCONFIGURED',
        date,
        hasData,
      );
    const generalTeacherState = teacherStateOf(false);
    const primaryTeacherState = teacherStateOf(true);

    for (const member of teachers) {
      teacherCounters.members++;
      const teacherState = member.primaryOnly
        ? primaryTeacherState
        : generalTeacherState;
      if (teacherState.state === 'DAY_OFF') {
        teacherCounters.dayOff++;
        continue;
      }
      if (teacherState.state === 'UNKNOWN' || !hasData) {
        teacherCounters.unknown++;
        if (teacherState.state === 'WORK_DAY') teacherCounters.noData++;
        continue;
      }
      if (teacherState.assumed) teacherCounters.assumedWorkDay++;

      const row = presentRow(MembershipType.TEACHER, member.pnfl);
      // O‘qituvchi uchun «boshlanish» — o‘sha kungi birinchi darsi.
      const late = row
        ? isLate(
            row.firstInTime,
            firstLessons.get(member.membershipId) ?? null,
            threshold,
          )
        : null;

      teacherCounters.expected++;
      if (row) {
        teacherCounters.present++;
        if (row.firstInTime && !row.lastOutTime) teacherCounters.inside++;
        if (late !== null) teacherCounters.lateEvaluated++;
        if (late) teacherCounters.late++;
      } else if (excused.has(`TEACHER:${member.personId}`)) {
        teacherCounters.excused++;
      } else {
        teacherCounters.absent++;
      }
    }

    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      for (const [type, counters] of [
        [MembershipType.STUDENT, studentCounters],
        [MembershipType.TEACHER, teacherCounters],
      ] as const) {
        const columns = Object.keys(counters) as (keyof Counters)[];
        await manager.query(
          `INSERT INTO school_daily_stats
             (schoolId, date, membershipType, districtId, regionId, hasData, computedAt, ${columns.join(', ')})
           VALUES (?, ?, ?, ?, ?, ?, NOW(3), ${columns.map(() => '?').join(', ')})
           ON DUPLICATE KEY UPDATE districtId = VALUES(districtId), regionId = VALUES(regionId),
             hasData = VALUES(hasData), computedAt = VALUES(computedAt),
             ${columns.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
          [
            schoolId,
            date,
            type,
            school.districtId,
            school.regionId,
            hasData ? 1 : 0,
            ...columns.map((c) => counters[c]),
          ],
        );
      }

      await manager.query(
        'DELETE FROM class_day_states WHERE schoolId = ? AND date = ?',
        [schoolId, date],
      );
      const classRows = [...classDays];
      if (classRows.length > 0) {
        await manager.query(
          `INSERT INTO class_day_states
             (classId, date, schoolId, state, hasData, expected, present, excused, absent, late)
           VALUES ${classRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          classRows.flatMap(([classId, day]) => [
            classId,
            date,
            schoolId,
            day.state,
            hasData ? 1 : 0,
            day.expected,
            day.present,
            day.excused,
            day.absent,
            day.late,
          ]),
        );
      }
    });

    await this.buildStreaks(schoolId, date, today, students);
  }

  /**
   * Ketma-ket 5 o‘quv kuni sababsiz kelmaganlar. Har sinf o‘z kalendari
   * bo‘yicha (5 yoki 6 kunlik hafta, bayramlar) — o‘quv kuni bo‘lmagan va
   * maktabdan ma’lumot kelmagan kunlar hisobga kirmaydi.
   * Bugungi hisobotda bugun hali tugamagan — bugun kirmaydi (kechagacha).
   */
  private async buildStreaks(
    schoolId: number,
    date: string,
    today: string,
    students: Member[],
  ): Promise<void> {
    const lastDay = date < today ? date : addDays(date, -1);
    const fromDay = addDays(lastDay, -STREAK_LOOKBACK_DAYS);

    const states: { classId: number; date: string | Date }[] =
      await this.dataSource.query(
        `SELECT classId, date FROM class_day_states
        WHERE schoolId = ? AND date BETWEEN ? AND ? AND state = 'WORK_DAY' AND hasData = 1
        ORDER BY date DESC`,
        [schoolId, fromDay, lastDay],
      );
    const workDays = new Map<number, string[]>();
    for (const row of states) {
      const list = workDays.get(Number(row.classId)) ?? [];
      list.push(sqlDate(row.date));
      workDays.set(Number(row.classId), list);
    }

    const rows: (string | number)[][] = [];

    if (workDays.size > 0) {
      const [presentRows, excuseRows, startRows]: [
        { pnfl: string; date: string | Date }[],
        {
          personId: number;
          startDate: string | Date;
          endDate: string | Date;
        }[],
        { personId: number; startDate: string | Date }[],
      ] = await Promise.all([
        this.dataSource.query(
          `SELECT pnfl, date FROM daily_attendance
            WHERE schoolId = ? AND membershipType = 'STUDENT' AND date BETWEEN ? AND ?
              AND (firstInTime IS NOT NULL OR lastOutTime IS NOT NULL)`,
          [schoolId, fromDay, lastDay],
        ),
        this.dataSource.query(
          `SELECT personId, startDate, endDate FROM attendance_excuses
            WHERE schoolId = ? AND membershipType = 'STUDENT' AND status = 'ACTIVE'
              AND startDate <= ? AND endDate >= ?`,
          [schoolId, lastDay, fromDay],
        ),
        this.dataSource.query(
          `SELECT personId, MIN(startDate) AS startDate FROM school_memberships
            WHERE schoolId = ? AND type = 'STUDENT' GROUP BY personId`,
          [schoolId],
        ),
      ]);

      const present = new Set(
        presentRows.map((r) => `${r.pnfl}:${sqlDate(r.date)}`),
      );
      const memberSince = new Map(
        startRows.map((r) => [Number(r.personId), sqlDate(r.startDate)]),
      );
      const excusesByPerson = new Map<
        number,
        { start: string; end: string }[]
      >();
      for (const row of excuseRows) {
        const list = excusesByPerson.get(Number(row.personId)) ?? [];
        list.push({ start: sqlDate(row.startDate), end: sqlDate(row.endDate) });
        excusesByPerson.set(Number(row.personId), list);
      }

      for (const student of students) {
        if (student.classId === null) continue;
        const since = memberSince.get(student.personId) ?? '0000-00-00';
        // Maktabga kelgunga qadar bo‘lgan kunlar kelmaslik emas.
        const days = (workDays.get(student.classId) ?? []).filter(
          (day) => day >= since,
        );
        if (days.length < ABSENCE_STREAK_DAYS) continue;

        const personExcuses = excusesByPerson.get(student.personId) ?? [];
        const streak = absenceStreak(
          days.map((day) => ({
            date: day,
            present: present.has(`${student.pnfl}:${day}`),
            excused: personExcuses.some((e) => e.start <= day && e.end >= day),
          })),
        );

        if (streak.days >= ABSENCE_STREAK_DAYS && streak.sinceDate) {
          rows.push([
            schoolId,
            date,
            student.personId,
            student.classId,
            streak.days,
            streak.sinceDate,
          ]);
        }
      }
    }

    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await manager.query(
        'DELETE FROM absence_streaks WHERE schoolId = ? AND date = ?',
        [schoolId, date],
      );
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await manager.query(
          `INSERT INTO absence_streaks (schoolId, date, personId, classId, days, sinceDate)
           VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
          chunk.flat(),
        );
      }
    });
  }

  private async members(
    schoolId: number,
    date: string,
    type: MembershipType,
  ): Promise<Member[]> {
    const rows: {
      personId: number;
      pnfl: string;
      classId: number | null;
      membershipId: number;
      primaryOnly: number;
    }[] = await this.dataSource.query(
      `SELECT m.personId, p.pnfl, MAX(m.classId) AS classId, MIN(m.id) AS membershipId,
              MAX(m.primaryOnly) AS primaryOnly
           FROM school_memberships m
           JOIN persons p ON p.id = m.personId AND p.deletedAt IS NULL
          WHERE m.schoolId = ? AND m.type = ? AND m.startDate <= ?
            AND (m.endDate IS NULL OR m.endDate > ?)
          GROUP BY m.personId, p.pnfl`,
      [schoolId, type, date, date],
    );
    return rows.map((row) => ({
      personId: Number(row.personId),
      pnfl: row.pnfl,
      classId: row.classId === null ? null : Number(row.classId),
      membershipId: Number(row.membershipId),
      primaryOnly: Number(row.primaryOnly) === 1,
    }));
  }

  /** Sinflarning shu sanadagi smenasi va boshlanish vaqti. */
  private async classShifts(
    classIds: number[],
    date: string,
  ): Promise<Map<number, { code: number; startTime: string }>> {
    const result = new Map<number, { code: number; startTime: string }>();
    if (classIds.length === 0) return result;

    const rows: { classId: number; code: number; startTime: string }[] =
      await this.dataSource.query(
        `SELECT cs.classId, ss.code, ss.startTime
         FROM school_class_shifts cs JOIN school_shifts ss ON ss.id = cs.shiftId
        WHERE cs.classId IN (${classIds.map(() => '?').join(',')})
          AND cs.startDate <= ? AND (cs.endDate IS NULL OR cs.endDate > ?)`,
        [...classIds, date, date],
      );
    for (const row of rows) {
      result.set(Number(row.classId), {
        code: Number(row.code),
        startTime: String(row.startTime),
      });
    }
    return result;
  }

  /** O‘qituvchining shu kungi birinchi darsi boshlanishi (dars jadvalidan). */
  private async teacherFirstLessons(
    membershipIds: number[],
    date: string,
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (membershipIds.length === 0 || dayOfWeek === 0) return result;

    const rows: { membershipId: number; startTime: string }[] =
      await this.dataSource.query(
        `SELECT a.teacherMembershipId AS membershipId, MIN(ls.startTime) AS startTime
         FROM lesson_schedules ls
         JOIN teacher_class_subjects a ON a.id = ls.teacherAssignmentId
        WHERE a.teacherMembershipId IN (${membershipIds.map(() => '?').join(',')})
          AND ls.dayOfWeek = ? AND ls.isActive = 1
          AND ls.startDate <= ? AND (ls.endDate IS NULL OR ls.endDate > ?)
        GROUP BY a.teacherMembershipId`,
        [...membershipIds, dayOfWeek, date, date],
      );
    for (const row of rows)
      result.set(Number(row.membershipId), String(row.startTime));
    return result;
  }
}
