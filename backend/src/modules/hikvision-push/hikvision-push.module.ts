import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';
import { LivePeopleService } from '../live/live-people.service';
import { HikvisionPushConsumer } from './hikvision-push.consumer';
import { HikvisionPushRebuildService } from './hikvision-push-rebuild.service';
import { PushEventWriterService } from './push-event-writer.service';
import { DashboardStatsQueueModule } from '../dashboard/dashboard-stats.queue';

/**
 * Push worker: Redis Stream → MySQL → daily_attendance → jonli efir.
 * HTTP qismi yo‘q — u `src/push-ingest` da alohida portda ishlaydi.
 * Faqat `push-worker.ts` jarayonida yuklanadi.
 */
@Module({
  imports: [RedisModule, DailyAttendanceModule, DashboardStatsQueueModule],
  providers: [
    HikvisionPushConsumer,
    HikvisionPushRebuildService,
    PushEventWriterService,
    LivePeopleService,
  ],
})
export class HikvisionPushModule {}
