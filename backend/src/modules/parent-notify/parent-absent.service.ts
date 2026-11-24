import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { assumeWorkDay } from '../daily-attendance/assumed-work-day';
import {
  attendanceCalendarKey,
  CalendarResolverService,
} from '../attendance-calendar/calendar-resolver.service';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { ParentNotifyService, tashkentParts } from './parent-notify.service';
import { str } from './str';

type Row = Record<string, unknown>;

/** Maktabda shu ulushdan kam o‘quvchi kelgan bo‘lsa (terminal ishlamayapti/dam olish), «kelmadi» yuborilmaydi. */
const MIN_ARRIVAL_SHARE = 0.1;
const MIN_ARRIVALS = 3;

function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * «Bugun kelmadi»: har sinf uchun smena boshlanishi + kutish vaqti (yoki maktabning standart vaqti)
 * o‘tgach, shu kuni hech qanday event bermagan, sababli arizasi yo‘q o‘quvchilarning ota-onalariga.
 * O‘quv kuni emas, yoki maktabda deyarli hech kim kelmagan bo‘lsa — yuborilmaydi.
 */
@Injectable()
export class ParentAbsentJob {
  private readonly logger = new Logger(ParentAbsentJob.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly parents: ParentNotifyService,
    private readonly calendar: CalendarResolverService,
  ) {}

  @Cron('0 */5 6-17 * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      this.parents.invalidateSchools();
      const schools: Row[] = await this.dataSource.query(
        `SELECT schoolId, TIME_FORMAT(defaultAbsentTime, '%H:%i') AS defaultTime, graceMinutes
           FROM parent_notification_schools WHERE enabled = 1`,
      );
      for (const school of schools) {
        await this.runSchool(
          Number(school.schoolId),
          str(school.defaultTime),
          Number(school.graceMinutes),
        ).catch((error: unknown) =>
          this.logger.warn(
            `Maktab #${Number(school.schoolId)}: ${(error as Error).message}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }

  async runSchool(
    schoolId: number,
    defaultTime: string,
    grace: number,
    now = new Date(),
  ): Promise<number> {
    const t = tashkentParts(now);
    const nowMinutes = t.hour * 60 + t.minute;

    // Sinflar va ularning (bugungi) smena boshlanishi.
    const classes: Row[] = await this.dataSource.query(
      `SELECT c.id AS classId, TIME_FORMAT(st.startTime, '%H:%i') AS startTime
         FROM school_classes c
         LEFT JOIN school_class_shifts cs ON cs.classId = c.id AND cs.startDate <= ?
              AND (cs.endDate IS NULL OR cs.endDate >= ?)
         LEFT JOIN school_shifts st ON st.id = cs.shiftId
        WHERE c.schoolId = ?`,
      [t.date, t.date, schoolId],
    );
    const client = this.redis.getClient();
    const due: { classId: number; start: string }[] = [];
    for (const row of classes) {
      const start = row.startTime
        ? str(row.startTime)
        : fromMinutes(toMinutes(defaultTime) - grace);
      if (toMinutes(start) + grace <= nowMinutes) {
        due.push({ classId: Number(row.classId), start });
      }
    }
    if (due.length === 0) return 0;

    const dayStart = new Date(`${t.date}T00:00:00+05:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);

    // Maktab bo‘yicha: kelganlar (event bergan) va jami faol o‘quvchilar.
    const presentRows: Row[] = await this.dataSource.query(
      `SELECT DISTINCT pnfl FROM attendance_events WHERE schoolId = ? AND eventAt >= ? AND eventAt < ?`,
      [schoolId, dayStart, dayEnd],
    );
    const present = new Set(presentRows.map((row) => str(row.pnfl)));
    const students: Row[] = await this.dataSource.query(
      `SELECT p.id, p.pnfl, p.firstName, p.lastName, m.classId
         FROM school_memberships m JOIN persons p ON p.id = m.personId AND p.deletedAt IS NULL
        WHERE m.schoolId = ? AND m.type = 'STUDENT'
          AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?)`,
      [schoolId, t.date, t.date],
    );
    const arrived = students.filter((student) =>
      present.has(str(student.pnfl)),
    ).length;
    if (arrived < MIN_ARRIVALS || arrived < students.length * MIN_ARRIVAL_SHARE)
      return 0;

    // O‘quv kuni emasmi (kalendar), sababli arizasi bormi.
    const states = await this.calendar.resolveForAttendanceDay(
      t.date,
      MembershipType.STUDENT,
      due.map((item) => ({
        schoolId,
        classId: item.classId,
        primaryOnly: false,
      })),
    );
    const excused: Row[] = await this.dataSource.query(
      `SELECT DISTINCT personId FROM attendance_excuses
        WHERE schoolId = ? AND membershipType = 'STUDENT' AND status = 'ACTIVE'
          AND startDate <= ? AND endDate >= ?`,
      [schoolId, t.date, t.date],
    );
    const excusedIds = new Set(excused.map((row) => Number(row.personId)));

    let queued = 0;
    for (const item of due) {
      const workday =
        assumeWorkDay(
          states.get(attendanceCalendarKey(schoolId, item.classId, false)) ??
            'UNCONFIGURED',
          t.date,
          true,
        ).state === 'WORK_DAY';
      if (!workday) continue;

      // Har sinf kuniga bir marta ishlanadi.
      const marker = await client.set(
        `edavomat:parent:absent:${schoolId}:${t.date}:${item.classId}`,
        '1',
        'EX',
        20 * 3600,
        'NX',
      );
      if (marker !== 'OK') continue;

      for (const student of students) {
        if (Number(student.classId) !== item.classId) continue;
        if (
          present.has(str(student.pnfl)) ||
          excusedIds.has(Number(student.id))
        )
          continue;
        queued += await this.parents.enqueue(
          Number(student.id),
          'ABSENT',
          `abs:${Number(student.id)}:${t.date}`,
          {
            name: `${str(student.lastName ?? '')} ${str(student.firstName ?? '')}`.trim(),
            start: item.start,
          },
        );
      }
    }
    if (queued > 0)
      this.logger.log(
        `Maktab #${schoolId}: ${queued} ta «kelmadi» xabari navbatga qo‘yildi`,
      );
    return queued;
  }
}
