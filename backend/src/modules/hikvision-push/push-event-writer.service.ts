import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import { LivePeopleService } from '../live/live-people.service';
import type { LiveSourceEvent } from '../live/live-people.service';
import { applyIncremental } from './daily-attendance-incremental';
import { HikvisionPushRebuildService } from './hikvision-push-rebuild.service';
import { DashboardStatsQueue } from '../dashboard/dashboard-stats.queue';
import {
  LIVE_CHANNEL_PREFIX,
  tashkentDate,
  type PushStreamEvent,
} from './hikvision-push.types';

interface StoredRow {
  id: string;
  terminalId: number;
  serialNo: string;
  eventAt: Date;
  photoPath: string | null;
  /** 1 — hozirgina yaratilgan (DB soati bo‘yicha). */
  fresh: number | string;
}

/** Event shundan eski bo‘lsa — terminal navbatdan yuboryapti (kechikmoqda). */
const LAG_THRESHOLD_MS = 10 * 60 * 1000;
export const PUSH_LAG_KEY_PREFIX = 'edav:push:lag:';

/** Jonli efirga faqat shu muddatdagi eventlar chiqadi. */
const LIVE_MAX_AGE_MS = 10 * 60 * 1000;

const keyOf = (terminalId: number, serialNo: string, at: Date) =>
  `${terminalId}:${serialNo}:${at.getTime()}`;

/**
 * Stream'dan kelgan paketni MySQL'ga yozadi:
 *  1. bitta INSERT ... ON DUPLICATE KEY UPDATE (polling bilan takror bo‘lsa
 *     ham rasmsiz yozuvga push rasmi biriktiriladi);
 *  2. daily_attendance inkremental yangilanadi;
 *  3. real vaqt sahifasiga Redis PUBLISH.
 */
@Injectable()
export class PushEventWriterService {
  private readonly logger = new Logger(PushEventWriterService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rebuild: HikvisionPushRebuildService,
    private readonly people: LivePeopleService,
    private readonly redisService: RedisService,
    private readonly statsQueue: DashboardStatsQueue,
  ) {}

  async write(events: PushStreamEvent[]): Promise<void> {
    if (events.length === 0) return;

    const rows = await this.insertEvents(events);
    await this.cleanupUnusedPhotos(events, rows);

    const seen = new Set<string>();
    const sources: (LiveSourceEvent & { fresh: boolean })[] = [];
    for (const event of events) {
      const row = rows.get(keyOf(event.t, event.n, new Date(event.at)));
      if (!row || seen.has(String(row.id))) continue;
      seen.add(String(row.id));
      sources.push({
        id: String(row.id),
        schoolId: event.s,
        terminalId: event.t,
        direction: event.d,
        eventAt: row.eventAt,
        date: tashkentDate(row.eventAt),
        pnfl: event.p,
        photoPath: row.photoPath,
        fresh: Number(row.fresh) === 1,
      });
    }

    await this.updateDailyAttendance(sources);
    await this.updateTerminals(events);
    await this.markLag(events);

    // Faqat yangi yozuvlar (takroriy push/polling emas) jonli efirga chiqadi.
    await this.publishLive(sources.filter((source) => source.fresh));
  }

  private async insertEvents(
    events: PushStreamEvent[],
  ): Promise<Map<string, StoredRow>> {
    const params: unknown[] = [];
    const values = events
      .map((event) => {
        const hasPhoto = Boolean(event.ph);
        params.push(
          event.t,
          event.s,
          event.p,
          event.n,
          new Date(event.at),
          event.d,
          event.mj,
          event.mn,
          'face',
          event.u,
          event.ph,
          hasPhoto
            ? EventPhotoStatus.DOWNLOADED
            : event.u
              ? EventPhotoStatus.PENDING
              : EventPhotoStatus.MISSING,
        );
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)';
      })
      .join(', ');

    // Tartib muhim: photoStatus eski photoPath bo‘yicha tekshiriladi.
    await this.dataSource.query(
      `INSERT INTO attendance_events
         (terminalId, schoolId, pnfl, serialNo, eventAt, direction, major, minor,
          verifyMode, sourcePictureUrl, photoPath, photoStatus, photoAttempts,
          photoLastAttemptAt)
       VALUES ${values} AS new
       ON DUPLICATE KEY UPDATE
         photoStatus = IF(attendance_events.photoPath IS NULL AND new.photoPath IS NOT NULL,
                          'DOWNLOADED', attendance_events.photoStatus),
         photoLastError = IF(attendance_events.photoPath IS NULL AND new.photoPath IS NOT NULL,
                             NULL, attendance_events.photoLastError),
         photoPath = COALESCE(attendance_events.photoPath, new.photoPath),
         sourcePictureUrl = COALESCE(attendance_events.sourcePictureUrl, new.sourcePictureUrl)`,
      params,
    );

    const keys: unknown[] = [];
    for (const event of events) keys.push(event.t, event.n, new Date(event.at));

    const stored: StoredRow[] = await this.dataSource.query(
      `SELECT id, terminalId, serialNo, eventAt, photoPath,
              createdAt >= NOW(3) - INTERVAL 60 SECOND AS fresh
         FROM attendance_events
        WHERE (terminalId, serialNo, eventAt) IN (${events.map(() => '(?, ?, ?)').join(', ')})`,
      keys,
    );

    return new Map(
      stored.map((row) => [
        keyOf(Number(row.terminalId), String(row.serialNo), row.eventAt),
        row,
      ]),
    );
  }

  /** Takroriy event uchun push yozgan, lekin bazaga tushmagan rasm fayllari. */
  private async cleanupUnusedPhotos(
    events: PushStreamEvent[],
    rows: Map<string, StoredRow>,
  ): Promise<void> {
    const unused = events.filter((event) => {
      if (!event.ph) return false;
      const row = rows.get(keyOf(event.t, event.n, new Date(event.at)));
      return row?.photoPath !== event.ph;
    });

    await Promise.all(
      unused.map((event) =>
        unlink(join(process.cwd(), event.ph!)).catch(() => undefined),
      ),
    );
  }

  private async updateDailyAttendance(
    sources: LiveSourceEvent[],
  ): Promise<void> {
    if (sources.length === 0) return;

    const pairs = [
      ...new Map(
        sources.map((s) => [
          `${s.schoolId}:${s.date}`,
          { schoolId: s.schoolId, date: s.date },
        ]),
      ).values(),
    ];
    const seeded = await this.rebuild.seededFlags(pairs);
    const schoolIds = [...new Set(sources.map((s) => s.schoolId))].sort(
      (a, b) => a - b,
    );

    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Rebuild bilan bir xil qulf; tartiblangan — deadlock bo‘lmaydi.
      await manager.query(
        `SELECT id FROM schools WHERE id IN (${schoolIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
        schoolIds,
      );
      await applyIncremental(manager, sources);
    });

    await this.rebuild.schedule(
      pairs.map((pair, index) => ({ ...pair, seeded: seeded[index] })),
    );
    await this.statsQueue.mark(pairs);
  }

  private async updateTerminals(events: PushStreamEvent[]): Promise<void> {
    const latest = new Map<number, number>();
    for (const event of events) {
      const at = new Date(event.at).getTime();
      if ((latest.get(event.t) ?? 0) < at) latest.set(event.t, at);
    }

    const entries = [...latest];
    const params: unknown[] = [];
    for (const [id, at] of entries) params.push(id, new Date(at));
    params.push(...entries.map(([id]) => id));

    try {
      await this.dataSource.query(
        `UPDATE terminals
            SET pushLastEventAt = GREATEST(
                  COALESCE(pushLastEventAt, '1970-01-01'),
                  CASE id ${entries.map(() => 'WHEN ? THEN ?').join(' ')} END)
          WHERE id IN (${entries.map(() => '?').join(',')})`,
        params,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `pushLastEventAt yangilanmadi: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /**
   * Terminal xotiradagi eski eventlarni yuborayotgan bo‘lsa (navbat), shu terminal
   * «kechikmoqda» deb belgilanadi. Kechikayotgan terminalning bugungi eventlarini
   * server o‘zi ISAPI orqali oladi (PushLagReconciler).
   */
  private async markLag(events: PushStreamEvent[]): Promise<void> {
    const lagging = new Set<number>();
    const threshold = Date.now() - LAG_THRESHOLD_MS;
    for (const event of events) {
      if (new Date(event.at).getTime() < threshold) lagging.add(event.t);
    }
    if (lagging.size === 0) return;

    try {
      const pipeline = this.redisService.getClient().pipeline();
      for (const terminalId of lagging) {
        pipeline.set(`${PUSH_LAG_KEY_PREFIX}${terminalId}`, '1', 'EX', 900);
      }
      await pipeline.exec();
    } catch {
      // Belgilash ixtiyoriy: davomat yozuvi allaqachon saqlangan.
    }
  }

  private async publishLive(all: LiveSourceEvent[]): Promise<void> {
    // Jonli efir — hozirgi o‘tishlar. Terminal xotiradagi eski eventlarni
    // yuborayotganda (navbat) ular efirga chiqmaydi; hisoblagichlar esa
    // bazadan olinadi va baribir to‘g‘ri o‘sadi.
    const since = Date.now() - LIVE_MAX_AGE_MS;
    const sources = all.filter((source) => source.eventAt.getTime() >= since);
    if (sources.length === 0) return;

    try {
      const bySchool = await this.people.enrich(sources);
      const pipeline = this.redisService.getClient().pipeline();
      for (const [schoolId, list] of bySchool) {
        pipeline.publish(
          `${LIVE_CHANNEL_PREFIX}${schoolId}`,
          JSON.stringify(list),
        );
      }
      await pipeline.exec();
    } catch (error: unknown) {
      // Jonli efir ixtiyoriy: davomat yozuvi allaqachon saqlangan.
      this.logger.warn(
        `Jonli efirga yuborilmadi: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
