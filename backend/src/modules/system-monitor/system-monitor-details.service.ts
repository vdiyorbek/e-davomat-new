import type { Dirent } from 'node:fs';
import { readdir, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';

import { ATTENDANCE_PHOTO_QUEUE } from '../attendance-photo-sync/attendance-photo-sync.constants';
import { PERSON_SYNC_QUEUE } from '../terminals/person-sync.constants';
import { TERMINAL_SYNC_QUEUE } from '../terminal-sync/terminal-sync.constants';

type Row = Record<string, unknown>;

export const DETAIL_KEYS = [
  'terminals',
  'photos',
  'queues',
  'disk',
  'push',
  'stats',
] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];

const OFFLINE_MINUTES = 15;
const DISK_BUDGET_MS = 8000;
const DISK_CACHE_MS = 10 * 60_000;

function minutesAgo(value: unknown, now: number): number | null {
  if (!value) return null;
  const time = new Date(value as Date).getTime();
  return Number.isNaN(time)
    ? null
    : Math.max(0, Math.round((now - time) / 60_000));
}

/**
 * «Batafsil» oynalari uchun ma’lumot: har bir tekshiruv ortidagi aniq ro‘yxat.
 * Faqat o‘qiydi; hech narsa o‘zgartirilmaydi.
 */
@Injectable()
export class SystemMonitorDetailsService {
  private diskCache: { at: number; value: unknown } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(TERMINAL_SYNC_QUEUE) private readonly terminalQueue: Queue,
    @InjectQueue(PERSON_SYNC_QUEUE) private readonly personQueue: Queue,
    @InjectQueue(ATTENDANCE_PHOTO_QUEUE) private readonly photoQueue: Queue,
  ) {}

  async details(key: string): Promise<unknown> {
    switch (key as DetailKey) {
      case 'terminals':
        return this.terminals();
      case 'photos':
        return this.photos();
      case 'queues':
        return this.queues();
      case 'disk':
        return this.disk();
      case 'push':
        return this.push();
      case 'stats':
        return this.stats();
      default:
        throw new NotFoundException('Noma’lum tekshiruv');
    }
  }

  /** 15 daqiqadan beri ko‘rinmayotgan faol terminallar. */
  private async terminals() {
    const now = Date.now();
    const rows: Row[] = await this.dataSource.query(
      `SELECT t.id, t.name, t.host, t.direction, t.eventSource, t.lastSeenAt, t.lastError,
              t.consecutiveFailures, s.name AS school, d.name AS district
         FROM terminals t JOIN schools s ON s.id = t.schoolId
         JOIN districts d ON d.id = s.districtId
        WHERE t.isActive = 1 AND t.archivedAt IS NULL
          AND (t.lastSeenAt IS NULL OR t.lastSeenAt < ?)
        ORDER BY t.lastSeenAt IS NULL DESC, t.lastSeenAt ASC LIMIT 200`,
      [new Date(now - OFFLINE_MINUTES * 60_000)],
    );
    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        host: row.host,
        direction: row.direction,
        eventSource: row.eventSource,
        school: row.school,
        district: row.district,
        lastSeenAt: row.lastSeenAt ?? null,
        minutes: minutesAgo(row.lastSeenAt, now),
        failures: Number(row.consecutiveFailures ?? 0),
        error: row.lastError ?? null,
      })),
    };
  }

  /** Oxirgi 24 soatda yuklanmagan rasmlar: terminal bo‘yicha va xato sabablari. */
  private async photos() {
    const byTerminal: Row[] = await this.dataSource.query(
      `SELECT e.terminalId AS id, t.name, t.host, s.name AS school,
              SUM(e.photoStatus = 'PENDING') AS pending,
              SUM(e.photoStatus = 'FAILED') AS failed,
              MAX(e.photoAttempts) AS maxAttempts
         FROM attendance_events e
         JOIN terminals t ON t.id = e.terminalId
         JOIN schools s ON s.id = e.schoolId
        WHERE e.photoStatus IN ('PENDING', 'FAILED')
          AND e.eventAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY e.terminalId, t.name, t.host, s.name
        ORDER BY SUM(e.photoStatus IN ('PENDING', 'FAILED')) DESC LIMIT 50`,
    );
    const reasons: Row[] = await this.dataSource.query(
      `SELECT LEFT(COALESCE(photoLastError, '—'), 120) AS reason, COUNT(*) AS total
         FROM attendance_events
        WHERE photoStatus IN ('PENDING', 'FAILED')
          AND eventAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY LEFT(COALESCE(photoLastError, '—'), 120)
        ORDER BY COUNT(*) DESC LIMIT 10`,
    );
    return {
      terminals: byTerminal.map((row) => ({
        id: Number(row.id),
        name: row.name,
        host: row.host,
        school: row.school,
        pending: Number(row.pending ?? 0),
        failed: Number(row.failed ?? 0),
        maxAttempts: Number(row.maxAttempts ?? 0),
      })),
      reasons: reasons.map((row) => ({
        reason: row.reason,
        total: Number(row.total),
      })),
    };
  }

  /** Xatoli fon vazifalari (har navbatdan oxirgi 20 tasi). */
  private async queues() {
    const queues: [string, Queue][] = [
      ['events', this.terminalQueue],
      ['persons', this.personQueue],
      ['photos', this.photoQueue],
    ];
    const items: {
      queue: string;
      id: string;
      name: string;
      reason: string;
      attempts: number;
      finishedAt: string | null;
    }[] = [];
    for (const [queueName, queue] of queues) {
      const failed = await queue.getFailed(0, 19);
      for (const job of failed) {
        items.push({
          queue: queueName,
          id: String(job.id ?? ''),
          name: job.name,
          reason: String(job.failedReason ?? '').slice(0, 240),
          attempts: job.attemptsMade,
          finishedAt: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
        });
      }
    }
    items.sort((a, b) =>
      (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
    );
    return { items: items.slice(0, 60) };
  }

  /** Disk: bo‘sh joy va `uploads` papkalari hajmi (10 daqiqa keshlanadi). */
  private async disk() {
    if (this.diskCache && Date.now() - this.diskCache.at < DISK_CACHE_MS) {
      return this.diskCache.value;
    }
    const root = join(process.cwd(), 'uploads');
    const deadline = Date.now() + DISK_BUDGET_MS;
    const state = { partial: false };

    const size = async (path: string): Promise<number> => {
      let total = 0;
      let entries: Dirent[];
      try {
        entries = await readdir(path, { withFileTypes: true });
      } catch {
        return 0;
      }
      for (const entry of entries) {
        if (Date.now() > deadline) {
          state.partial = true;
          return total;
        }
        const full = join(path, entry.name);
        if (entry.isDirectory()) total += await size(full);
        else if (entry.isFile()) {
          try {
            total += (await stat(full)).size;
          } catch {
            /* o‘chirilgan fayl */
          }
        }
      }
      return total;
    };

    const folders: { path: string; bytes: number }[] = [];
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        folders.push({
          path: `uploads/${entry.name}`,
          bytes: await size(join(root, entry.name)),
        });
      }
    } catch {
      /* uploads yo‘q */
    }
    folders.sort((a, b) => b.bytes - a.bytes);

    const fs = await statfs(process.cwd());
    const value = {
      totalBytes: fs.blocks * fs.bsize,
      freeBytes: fs.bavail * fs.bsize,
      folders,
      partial: state.partial,
    };
    this.diskCache = { at: Date.now(), value };
    return value;
  }

  /** Push terminallar: oxirgi so‘rov vaqti bo‘yicha (eng jimlari tepada). */
  private async push() {
    const now = Date.now();
    const rows: Row[] = await this.dataSource.query(
      `SELECT t.id, t.name, t.host, t.pushEnabled, t.pushLastReceivedAt, t.pushLastEventAt,
              s.name AS school
         FROM terminals t JOIN schools s ON s.id = t.schoolId
        WHERE t.isActive = 1 AND t.archivedAt IS NULL AND t.eventSource = 'PUSH'
        ORDER BY t.pushLastReceivedAt IS NULL DESC, t.pushLastReceivedAt ASC LIMIT 100`,
    );
    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        host: row.host,
        school: row.school,
        pushEnabled: row.pushEnabled === 1 || row.pushEnabled === true,
        lastReceivedAt: row.pushLastReceivedAt ?? null,
        lastEventAt: row.pushLastEventAt ?? null,
        minutes: minutesAgo(row.pushLastReceivedAt, now),
      })),
    };
  }

  /** Statistikasi eskirgan maktablar (bugungi/kechagi qator 60 daqiqadan eski). */
  private async stats() {
    const now = Date.now();
    const rows: Row[] = await this.dataSource.query(
      `SELECT s.id, s.name, d.name AS district, MAX(st.computedAt) AS computedAt
         FROM school_daily_stats st
         JOIN schools s ON s.id = st.schoolId
         JOIN districts d ON d.id = s.districtId
        WHERE st.date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        GROUP BY s.id, s.name, d.name
       HAVING MAX(st.computedAt) < DATE_SUB(NOW(), INTERVAL 60 MINUTE)
        ORDER BY MAX(st.computedAt) ASC LIMIT 100`,
    );
    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        district: row.district,
        computedAt: row.computedAt,
        minutes: minutesAgo(row.computedAt, now),
      })),
    };
  }
}
