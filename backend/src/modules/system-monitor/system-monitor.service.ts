import { statfs } from 'node:fs/promises';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { ATTENDANCE_PHOTO_QUEUE } from '../attendance-photo-sync/attendance-photo-sync.constants';
import { PERSON_SYNC_QUEUE } from '../terminals/person-sync.constants';
import { TERMINAL_SYNC_QUEUE } from '../terminal-sync/terminal-sync.constants';
import {
  byHigh,
  byLow,
  freshnessStatus,
  isWorkTime,
} from './system-monitor.rules';
import type {
  CheckKey,
  CheckResult,
  CheckStatus,
  HealthSnapshot,
} from './system-monitor.types';
import { worst } from './system-monitor.types';

const MB = 1024 * 1024;

function minutesSince(value: Date | string | null, now: Date): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time)
    ? null
    : Math.max(0, Math.round((now.getTime() - time) / 60_000));
}

/**
 * Tizim holati tekshiruvlari. Faqat o‘qiydi; har biri o‘z xatosini
 * `crit` natijaga aylantiradi, shuning uchun bittasi qulasa ham qolganlari ishlaydi.
 */
@Injectable()
export class SystemMonitorService {
  private latest: HealthSnapshot | null = null;
  private readonly since = new Map<
    CheckKey,
    { status: CheckStatus; at: Date }
  >();

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    @InjectQueue(TERMINAL_SYNC_QUEUE) private readonly terminalQueue: Queue,
    @InjectQueue(PERSON_SYNC_QUEUE) private readonly personQueue: Queue,
    @InjectQueue(ATTENDANCE_PHOTO_QUEUE) private readonly photoQueue: Queue,
  ) {}

  /** Oxirgi hisoblangan holat; 45 soniyadan eski bo‘lsa yangidan hisoblanadi. */
  async current(): Promise<HealthSnapshot> {
    const fresh =
      this.latest &&
      Date.now() - new Date(this.latest.generatedAt).getTime() < 45_000;
    return fresh && this.latest ? this.latest : this.evaluate();
  }

  async evaluate(): Promise<HealthSnapshot> {
    const now = new Date();
    const results = await Promise.all([
      this.guard('database', () => this.database()),
      this.guard('redis', () => this.redisCheck()),
      this.guard('queues', () => this.queues()),
      this.guard('disk', () => this.disk()),
      this.guard('push', () => this.push(now)),
      this.guard('stats', () => this.stats(now)),
      this.guard('photos', () => this.photos()),
      this.guard('terminals', () => this.terminals(now)),
      this.guard('process', () => Promise.resolve(this.processCheck())),
    ]);

    const checks = results.map((result) => {
      const previous = this.since.get(result.key);
      if (!previous || previous.status !== result.status) {
        this.since.set(result.key, { status: result.status, at: now });
      }
      return {
        ...result,
        since: (this.since.get(result.key)?.at ?? now).toISOString(),
      };
    });

    this.latest = {
      generatedAt: now.toISOString(),
      overall: worst(checks.map((check) => check.status)),
      checks,
    };
    return this.latest;
  }

  /** Ochiq `/health` uchun: faqat baza va Redis. */
  async liveness(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  private async guard(
    key: CheckKey,
    run: () => Promise<CheckResult>,
  ): Promise<CheckResult> {
    try {
      return await run();
    } catch (error) {
      return {
        key,
        status: 'crit',
        metrics: {
          error: (error instanceof Error ? error.message : 'Xato').slice(
            0,
            120,
          ),
        },
      };
    }
  }

  private async timed<T>(run: () => Promise<T>): Promise<[T, number]> {
    const started = Date.now();
    const value = await run();
    return [value, Date.now() - started];
  }

  private async database(): Promise<CheckResult> {
    const [, ms] = await this.timed(() => this.dataSource.query('SELECT 1'));
    return {
      key: 'database',
      status: byHigh(ms, 300, 2000),
      metrics: { ms },
    };
  }

  private async redisCheck(): Promise<CheckResult> {
    const [pong, ms] = await this.timed(() => this.redis.ping());
    if (pong !== 'PONG') throw new Error('Redis javobi noto‘g‘ri');
    return { key: 'redis', status: byHigh(ms, 200, 1500), metrics: { ms } };
  }

  private async queues(): Promise<CheckResult> {
    const queues: [string, Queue][] = [
      ['events', this.terminalQueue],
      ['persons', this.personQueue],
      ['photos', this.photoQueue],
    ];
    let waiting = 0;
    let failed = 0;
    let active = 0;
    const metrics: Record<string, number | string | null> = {};
    for (const [name, queue] of queues) {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      const queued = (counts.waiting ?? 0) + (counts.delayed ?? 0);
      waiting += queued;
      failed += counts.failed ?? 0;
      active += counts.active ?? 0;
      metrics[`${name}Waiting`] = queued;
      metrics[`${name}Failed`] = counts.failed ?? 0;
    }
    metrics.waiting = waiting;
    metrics.failed = failed;
    metrics.active = active;
    return {
      key: 'queues',
      status: worst([byHigh(waiting, 2000, 20000), byHigh(failed, 200, 2000)]),
      metrics,
    };
  }

  private async disk(): Promise<CheckResult> {
    const stats = await statfs(process.cwd());
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const freePercent = total > 0 ? Math.round((100 * free) / total) : 0;
    return {
      key: 'disk',
      status: byLow(freePercent, 20, 10),
      metrics: {
        freePercent,
        freeGb: Math.round((free / (1024 * MB)) * 10) / 10,
      },
    };
  }

  /** Terminallardan oxirgi push qachon kelgani (ish vaqtida). */
  private async push(now: Date): Promise<CheckResult> {
    const [row]: { lastAt: Date | null; total: string }[] =
      await this.dataSource.query(
        `SELECT MAX(pushLastReceivedAt) AS lastAt, COUNT(*) AS total
           FROM terminals
          WHERE isActive = 1 AND archivedAt IS NULL AND eventSource = 'PUSH'`,
      );
    const total = Number(row?.total ?? 0);
    const age = minutesSince(row?.lastAt ?? null, now);
    const working = isWorkTime(now, 7, 19) && total > 0;
    return {
      key: 'push',
      status: freshnessStatus(age, 10, 30, working),
      metrics: { minutes: age, terminals: total, working: working ? 1 : 0 },
    };
  }

  /** Dashboard statistikasi oxirgi marta qachon hisoblangan (har 20 daqiqada yangilanadi). */
  private async stats(now: Date): Promise<CheckResult> {
    const [row]: { lastAt: Date | null }[] = await this.dataSource.query(
      `SELECT MAX(computedAt) AS lastAt FROM school_daily_stats
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
    );
    const age = minutesSince(row?.lastAt ?? null, now);
    const working = isWorkTime(now, 7, 21);
    return {
      key: 'stats',
      status: freshnessStatus(age, 60, 180, working),
      metrics: { minutes: age, working: working ? 1 : 0 },
    };
  }

  /** Oxirgi 24 soatdagi yuklanmagan (PENDING/FAILED) rasmlar. */
  private async photos(): Promise<CheckResult> {
    const [row]: { pending: string; failed: string }[] =
      await this.dataSource.query(
        `SELECT SUM(photoStatus = 'PENDING') AS pending,
                SUM(photoStatus = 'FAILED') AS failed
           FROM attendance_events
          WHERE photoStatus IN ('PENDING', 'FAILED')
            AND eventAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      );
    const pending = Number(row?.pending ?? 0);
    const failed = Number(row?.failed ?? 0);
    return {
      key: 'photos',
      status: byHigh(pending + failed, 500, 5000),
      metrics: { pending, failed },
    };
  }

  /** Faol terminallardan nechtasi 15 daqiqadan beri ko‘rinmayapti. */
  private async terminals(now: Date): Promise<CheckResult> {
    const [row]: { total: string; offline: string }[] =
      await this.dataSource.query(
        `SELECT COUNT(*) AS total,
                SUM(lastSeenAt IS NULL OR lastSeenAt < ?) AS offline
           FROM terminals WHERE isActive = 1 AND archivedAt IS NULL`,
        [new Date(now.getTime() - 15 * 60_000)],
      );
    const total = Number(row?.total ?? 0);
    const offline = Number(row?.offline ?? 0);
    const percent = total > 0 ? Math.round((100 * offline) / total) : 0;
    return {
      key: 'terminals',
      status: byHigh(percent, 10, 30),
      metrics: { total, offline, percent },
    };
  }

  private processCheck(): CheckResult {
    const memory = process.memoryUsage();
    const rssMb = Math.round(memory.rss / MB);
    return {
      key: 'process',
      status: byHigh(rssMb, 1536, 3072),
      metrics: {
        uptimeMinutes: Math.round(process.uptime() / 60),
        rssMb,
        heapMb: Math.round(memory.heapUsed / MB),
      },
    };
  }
}
