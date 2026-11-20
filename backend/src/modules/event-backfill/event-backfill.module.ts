import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '../../redis/redis.module';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';
import { Terminal } from '../terminals/terminal.entity';
import { EventActivityModule } from '../event-activity/event-activity.module';
import { EventBackfillController } from './event-backfill.controller';
import { EventBackfillService } from './event-backfill.service';
import { PushLagReconcilerService } from './push-lag-reconciler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Terminal]),
    RedisModule,
    EventActivityModule,
    AttendanceEventsModule,
    DailyAttendanceModule,
  ],
  controllers: [EventBackfillController],
  providers: [EventBackfillService, PushLagReconcilerService],
})
export class EventBackfillModule {}
