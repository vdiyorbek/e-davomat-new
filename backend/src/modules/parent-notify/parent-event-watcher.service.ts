import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { ParentNotifyService, tashkentParts } from './parent-notify.service';
import { str } from './str';

type Row = Record<string, unknown>;

const CURSOR_KEY = 'edavomat:parent:event-cursor';
const BATCH = 2000;
const FRESH_MS = 3 * 3600_000; // eski (qayta olingan) eventlar uchun xabar yuborilmaydi

/**
 * Yangi eventlarni kuzatadi: o‘quvchining kunlik birinchi KIRISHI («keldi») va
 * birinchi CHIQISHI («ketdi») ota-onaga xabar bo‘ladi. Faqat sinov maktablari.
 * Kursor Redis'da; birinchi ishga tushishda mavjud eventlar xabar qilinmaydi.
 */
@Injectable()
export class ParentEventWatcher {
  private readonly logger = new Logger(ParentEventWatcher.name);
  private running = false;
  private seen = new Set<string>();
  private seenDay = '';

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly parents: ParentNotifyService,
  ) {}

  @Cron('*/20 * * * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const client = this.redis.getClient();
      const saved = await client.get(CURSOR_KEY);
      if (saved === null) {
        const [row]: Row[] = await this.dataSource.query(
          'SELECT COALESCE(MAX(id), 0) AS id FROM attendance_events',
        );
        await client.set(CURSOR_KEY, str(row?.id ?? 0));
        return;
      }
      const events: Row[] = await this.dataSource.query(
        `SELECT id, schoolId, pnfl, direction, eventAt FROM attendance_events
          WHERE id > ? ORDER BY id ASC LIMIT ${BATCH}`,
        [saved],
      );
      if (events.length === 0) return;

      await this.process(events);
      await client.set(CURSOR_KEY, str(events[events.length - 1]?.id));
    } catch (error) {
      this.logger.error(`Event kuzatuvi: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async process(events: Row[]): Promise<void> {
    const enabled = await this.parents.enabledSchoolIds();
    if (enabled.size === 0) return;
    const now = Date.now();
    const today = tashkentParts(new Date()).date;
    if (this.seenDay !== today) {
      this.seen = new Set();
      this.seenDay = today;
    }

    const fresh = events.filter(
      (event) =>
        enabled.has(Number(event.schoolId)) &&
        now - new Date(event.eventAt as Date).getTime() < FRESH_MS,
    );
    if (fresh.length === 0) return;

    // pnfl → faol o‘quvchi (shu maktabda)
    const pnfls = [...new Set(fresh.map((event) => str(event.pnfl)))];
    const students: Row[] = await this.dataSource.query(
      `SELECT p.id, p.pnfl, p.firstName, p.lastName, m.schoolId
         FROM persons p JOIN school_memberships m ON m.personId = p.id AND m.type = 'STUDENT'
              AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE())
        WHERE p.deletedAt IS NULL AND p.pnfl IN (${pnfls.map(() => '?').join(',')})`,
      pnfls,
    );
    const byKey = new Map(
      students.map((row) => [`${Number(row.schoolId)}:${str(row.pnfl)}`, row]),
    );

    for (const event of fresh) {
      const student = byKey.get(`${Number(event.schoolId)}:${str(event.pnfl)}`);
      if (!student) continue;
      const at = new Date(event.eventAt as Date);
      const t = tashkentParts(at);
      const personId = Number(student.id);
      const isIn = event.direction === 'IN';
      const key = `${isIn ? 'arr' : 'left'}:${personId}:${t.date}`;
      if (this.seen.has(key)) continue;

      if (!isIn) {
        // «Ketdi» faqat shu kuni kirgan bo‘lsa.
        const [entered]: Row[] = await this.dataSource.query(
          `SELECT 1 AS ok FROM attendance_events
            WHERE schoolId = ? AND pnfl = ? AND direction = 'IN' AND eventAt >= ? AND eventAt <= ? LIMIT 1`,
          [
            Number(event.schoolId),
            str(event.pnfl),
            new Date(`${t.date}T00:00:00+05:00`),
            at,
          ],
        );
        if (!entered) continue;
      }
      this.seen.add(key);
      await this.parents.enqueue(personId, isIn ? 'ARRIVED' : 'LEFT', key, {
        name: `${str(student.lastName ?? '')} ${str(student.firstName ?? '')}`.trim(),
        time: t.time,
      });
    }
  }
}
