import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../../redis/redis.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';
import { dailySeededKey } from './hikvision-push.types';

const DIRTY_KEY = 'edav:push:rebuild-dirty';
const RETRY_MS = 30_000;
const LOCK_SECONDS = 180;
const SEEDED_TTL_SECONDS = 2 * 24 * 60 * 60;

const RELEASE_LOCK = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const REMOVE_IF_UNCHANGED = `
  local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if score == ARGV[2] then
    return redis.call('ZREM', KEYS[1], ARGV[1])
  end
  return 0
`;

const RETRY_IF_UNCHANGED = `
  local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if score == ARGV[2] then
    return redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
  end
  return 0
`;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

/**
 * To‘liq qayta hisoblash (DailyAttendanceService.rebuild) endi faqat:
 *  1) kunning birinchi eventida — barcha a’zolar uchun qatorlarni yaratish;
 *  2) har PUSH_RECONCILE_MINUTES daqiqada bir marta — yangi a’zolar va
 *     qo‘lda tuzatishlarni qamrab olish uchun.
 * Oradagi har bir event daily_attendance'ga inkremental yoziladi.
 *
 * ZADD NX: yangi eventlar muddatni surmaydi. Avvalgi debounce'da
 * doimiy oqim bo‘lgan maktabda rebuild hech qachon boshlanmas edi.
 */
@Injectable()
export class HikvisionPushRebuildService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(HikvisionPushRebuildService.name);
  private readonly seedDelayMs: number;
  private readonly reconcileMs: number;
  private readonly concurrency: number;
  private stopped = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly dailyAttendance: DailyAttendanceService,
    config: ConfigService,
  ) {
    this.seedDelayMs = Number(config.get('PUSH_SEED_DELAY_MS') ?? 5000);
    this.reconcileMs =
      Number(config.get('PUSH_RECONCILE_MINUTES') ?? 15) * 60_000;
    this.concurrency = Math.max(
      1,
      Number(config.get('PUSH_REBUILD_CONCURRENCY') ?? 4),
    );
  }

  onApplicationBootstrap(): void {
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.loop;
  }

  /** Qaysi maktab-kunlar hali to‘liq hisoblanmagan. */
  async seededFlags(
    pairs: { schoolId: number; date: string }[],
  ): Promise<boolean[]> {
    if (pairs.length === 0) return [];
    const values = await this.redisService
      .getClient()
      .mget(pairs.map((pair) => dailySeededKey(pair.schoolId, pair.date)));
    return values.map((value) => value !== null);
  }

  async schedule(
    pairs: { schoolId: number; date: string; seeded: boolean }[],
  ): Promise<void> {
    if (pairs.length === 0) return;
    const now = Date.now();
    const args: (string | number)[] = [];

    for (const pair of pairs) {
      args.push(
        now + (pair.seeded ? this.reconcileMs : this.seedDelayMs),
        `${pair.schoolId}:${pair.date}`,
      );
    }

    // Bitta buyruq bilan butun paket.
    await this.redisService.getClient().zadd(DIRTY_KEY, 'NX', ...args);
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      let processed = 0;

      try {
        const members = await this.redisService
          .getClient()
          .zrangebyscore(
            DIRTY_KEY,
            '-inf',
            Date.now(),
            'LIMIT',
            0,
            this.concurrency * 4,
          );

        const queue = [...members];
        await Promise.all(
          Array.from(
            { length: Math.min(this.concurrency, queue.length) },
            async () => {
              for (let member = queue.shift(); member; member = queue.shift()) {
                if (this.stopped) return;
                await this.rebuildOne(member);
                processed++;
              }
            },
          ),
        );
      } catch (error: unknown) {
        this.logger.error(`Rebuild navbati xatosi: ${errorText(error)}`);
      }

      // Navbat bo‘sh bo‘lsa kutamiz, aks holda darhol davom etamiz.
      if (processed === 0)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async rebuildOne(member: string): Promise<void> {
    const match = /^([1-9]\d*):(\d{4}-\d{2}-\d{2})$/.exec(member);
    const redis = this.redisService.getClient();

    if (!match) {
      this.logger.error('Rebuild kaliti noto‘g‘ri');
      await redis.zrem(DIRTY_KEY, member);
      return;
    }

    const schoolId = Number(match[1]);
    const date = match[2];

    const lockKey = `edav:push:rebuild-lock:${member}`;
    const token = randomUUID();

    const acquired = await redis.set(lockKey, token, 'EX', LOCK_SECONDS, 'NX');
    if (acquired !== 'OK') return;

    try {
      const score = await redis.zscore(DIRTY_KEY, member);
      if (score === null || Number(score) > Date.now()) return;

      try {
        await this.dailyAttendance.rebuild({ schoolId, date });

        await redis
          .multi()
          .set(dailySeededKey(schoolId, date), '1', 'EX', SEEDED_TTL_SECONDS)
          .eval(REMOVE_IF_UNCHANGED, 1, DIRTY_KEY, member, score)
          .exec();
      } catch (error: unknown) {
        await redis.eval(
          RETRY_IF_UNCHANGED,
          1,
          DIRTY_KEY,
          member,
          score,
          String(Date.now() + RETRY_MS),
        );

        this.logger.error(
          `Rebuild xatosi: maktab=${schoolId}, sana=${date}: ${errorText(error)}`,
        );
      }
    } finally {
      await redis.eval(RELEASE_LOCK, 1, lockKey, token).catch(() => {
        this.logger.warn(`Rebuild lock bo‘shatilmadi: ${member}`);
      });
    }
  }
}
