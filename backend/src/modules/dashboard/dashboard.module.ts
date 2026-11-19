import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { AttendanceCalendarModule } from '../attendance-calendar/attendance-calendar.module';
import { DashboardStatsBuilder } from './dashboard-stats.builder';
import { DashboardStatsQueueModule } from './dashboard-stats.queue';
import { DashboardStatsRefresher } from './dashboard-stats.refresher';
import {
  DashboardController,
  SchoolAttendanceSettingsController,
} from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Administratorlar bosh sahifasi: davomat statistikasi va xarita. */
@Module({
  imports: [RedisModule, AttendanceCalendarModule, DashboardStatsQueueModule],
  controllers: [DashboardController, SchoolAttendanceSettingsController],
  providers: [DashboardStatsBuilder, DashboardStatsRefresher, DashboardService],
})
export class DashboardModule {}
