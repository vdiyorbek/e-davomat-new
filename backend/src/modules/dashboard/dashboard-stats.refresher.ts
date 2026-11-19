import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { addDays, todayInTashkent } from '../teacher/teacher-context.service';
import { DashboardStatsBuilder } from './dashboard-stats.builder';
import { DashboardStatsQueue, STATS_DIRTY_KEY } from './dashboard-stats.queue';

const RETRY_MS = 60_000;
const LOCK_SECONDS = 120;

const RELEASE_LOCK = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
  return 0`;
const REMOVE_IF_UNCHANGED = `
  if redis.call('ZSCORE', KEYS[1], ARGV[1]) == ARGV[2] then return redis.call('ZREM', KEYS[1], ARGV[1]) end
  return 0`;
const RETRY_IF_UNCHANGED = `
  if redis.call('ZSCORE', KEYS[1], ARGV[1]) == ARGV[2] then return redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1]) end
  return 0`;

/**
 * Navbatdagi maktab-kunlarni hisoblaydi. Bundan tashqari:
 *  — kun davomida har 20 daqiqada barcha maktablarning bugungi kuni
 *    (hech kim kelmagan, terminali ishlamagan maktab ham statistikaga kirsin);
 *  — tunda kechagi kun yakuniy holatda qayta hisoblanadi.
 */
@Injectable()
export class DashboardStatsRefresher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DashboardStatsRefresher.name);
  private readonly concurrency: number;
  private stopped = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly builder: DashboardStatsBuilder,
    private readonly queue: DashboardStatsQueue,
    config: ConfigService,
  ) {
    this.concurrency = Math.max(
      1,
      Number(config.get('DASHBOARD_STATS_CONCURRENCY') ?? 4),
    );
  }

  onApplicationBootstrap(): void {
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.loop;
  }

  @Cron('0 */20 6-21 * * *', { timeZone: 'Asia/Tashkent' })
  async sweepToday(): Promise<void> {
    await this.markAllSchools([todayInTashkent()], 5 * 60_000);
  }

  @Cron('0 15 0 * * *', { timeZone: 'Asia/Tashkent' })
  async finalizeYesterday(): Promise<void> {
    await this.markAllSchools([addDays(todayInTashkent(), -1)], 10 * 60_000);
  }

  /** Barcha maktablar uchun berilgan sanalarni navbatga qo‘yadi. */
  async markAllSchools(dates: string[], spreadMs: number): Promise<number> {
    const schools: { id: number }[] = await this.dataSource.query(
      'SELECT id FROM schools',
    );
    const days = dates.flatMap((date) =>
      schools.map((s) => ({ schoolId: Number(s.id), date })),
    );
    await this.queue.mark(days, spreadMs);
    return days.length;
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      let processed = 0;
      try {
        const members = await this.redisService
          .getClient()
          .zrangebyscore(
            STATS_DIRTY_KEY,
            '-inf',
            Date.now(),
            'LIMIT',
            0,
            this.concurrency * 5,
          );
        // Eski sanalar avval: ketma-ketlik hisobi oldingi kunlarga tayanadi.
        const queue = members.sort((a, b) =>
          a.split(':')[1].localeCompare(b.split(':')[1]),
        );

        await Promise.all(
          Array.from(
            { length: Math.min(this.concurrency, queue.length) },
            async () => {
              for (let member = queue.shift(); member; member = queue.shift()) {
                if (this.stopped) return;
                await this.refreshOne(member);
                processed++;
              }
            },
          ),
        );
      } catch (error: unknown) {
        this.logger.error(
          `Statistika navbati xatosi: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
      if (processed === 0)
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private async refreshOne(member: string): Promise<void> {
    const redis = this.redisService.getClient();
    const match = /^([1-9]\d*):(\d{4}-\d{2}-\d{2})$/.exec(member);
    if (!match) {
      await redis.zrem(STATS_DIRTY_KEY, member);
      return;
    }

    const schoolId = Number(match[1]);
    const date = match[2];
    const lockKey = `edav:stats:lock:${member}`;
    const token = randomUUID();
    if ((await redis.set(lockKey, token, 'EX', LOCK_SECONDS, 'NX')) !== 'OK')
      return;

    try {
      const score = await redis.zscore(STATS_DIRTY_KEY, member);
      if (score === null || Number(score) > Date.now()) return;

      try {
        await this.builder.build(schoolId, date);
        await redis.eval(
          REMOVE_IF_UNCHANGED,
          1,
          STATS_DIRTY_KEY,
          member,
          score,
        );

        // Keyingi kunning «ketma-ket kelmaganlar» hisobi shu kunga tayanadi.
        const next = addDays(date, 1);
        if (next <= todayInTashkent())
          await this.queue.mark([{ schoolId, date: next }], 5_000);
      } catch (error: unknown) {
        await redis.eval(
          RETRY_IF_UNCHANGED,
          1,
          STATS_DIRTY_KEY,
          member,
          score,
          String(Date.now() + RETRY_MS),
        );
        this.logger.error(
          `Statistika xatosi: maktab=${schoolId}, sana=${date}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    } finally {
      await redis.eval(RELEASE_LOCK, 1, lockKey, token).catch(() => undefined);
    }
  }
}
