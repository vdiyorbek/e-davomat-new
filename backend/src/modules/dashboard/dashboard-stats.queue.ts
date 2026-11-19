import { Injectable, Logger, Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { RedisService } from '../../redis/redis.service';

export const STATS_DIRTY_KEY = 'edav:stats:dirty';

export interface SchoolDay {
  schoolId: number;
  date: string;
}

/**
 * «Bu maktab-kunning statistikasini qayta hisoblash kerak» belgisi.
 * Davomat o‘zgargan har joydan chaqiriladi; hisoblashning o‘zi API
 * jarayonidagi DashboardStatsRefresher’da, guruhlab bajariladi.
 */
@Injectable()
export class DashboardStatsQueue {
  private readonly logger = new Logger(DashboardStatsQueue.name);

  constructor(private readonly redisService: RedisService) {}

  /** NX: allaqachon navbatda bo‘lsa muddat surilmaydi (doimiy oqimda ham hisoblanadi). */
  async mark(days: SchoolDay[], delayMs = 10_000): Promise<void> {
    if (days.length === 0) return;
    const redis = this.redisService.getClient();

    try {
      for (let i = 0; i < days.length; i += 1000) {
        const args: (string | number)[] = [];
        for (const day of days.slice(i, i + 1000)) {
          // Ko‘p maktab birdan belgilansa, yuk vaqt bo‘yicha taqsimlanadi.
          args.push(
            Date.now() +
              delayMs +
              (days.length > 50 ? Math.floor(Math.random() * delayMs) : 0),
          );
          args.push(`${day.schoolId}:${day.date}`);
        }
        await redis.zadd(STATS_DIRTY_KEY, 'NX', ...args);
      }
    } catch (error: unknown) {
      // Statistika ikkinchi darajali: davomat yozuvini to‘xtatmaymiz.
      this.logger.warn(
        `Statistika navbatiga yozilmadi: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}

@Module({
  imports: [RedisModule],
  providers: [DashboardStatsQueue],
  exports: [DashboardStatsQueue],
})
export class DashboardStatsQueueModule {}
