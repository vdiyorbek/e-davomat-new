import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DailyAttendance } from './daily-attendance.entity';
import { DailyAttendanceController } from './daily-attendance.controller';
import { DailyAttendanceService } from './daily-attendance.service';
import { DailyAttendanceMaterializer } from './daily-attendance-materializer.service';
import { DailyAttendanceReadService } from './daily-attendance-read.service';
import { DailyAttendanceExportService } from './daily-attendance-export.service';
import { DailyAttendanceSummaryService } from './daily-attendance-summary.service';
import { DailyAttendancePersonService } from './daily-attendance-person.service';
import { AttendanceCalendarModule } from '../attendance-calendar/attendance-calendar.module';
import { DashboardStatsQueueModule } from '../dashboard/dashboard-stats.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyAttendance]),
    AttendanceCalendarModule,
    DashboardStatsQueueModule,
  ],
  controllers: [DailyAttendanceController],
  providers: [
    DailyAttendanceService,
    DailyAttendanceMaterializer,
    DailyAttendanceReadService,
    DailyAttendanceExportService,
    DailyAttendanceSummaryService,
    DailyAttendancePersonService,
  ],
  exports: [DailyAttendanceService],
})
export class DailyAttendanceModule {}
