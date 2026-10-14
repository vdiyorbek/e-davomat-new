import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DailyAttendance } from './daily-attendance.entity';
import { DailyAttendanceController } from './daily-attendance.controller';
import { DailyAttendanceService } from './daily-attendance.service';
import { DailyAttendanceReadService } from './daily-attendance-read.service';
import { DailyAttendanceExportService } from './daily-attendance-export.service';

@Module({
  imports: [TypeOrmModule.forFeature([DailyAttendance])],
  controllers: [DailyAttendanceController],
  providers: [
    DailyAttendanceService,
    DailyAttendanceReadService,
    DailyAttendanceExportService,
  ],
  exports: [DailyAttendanceService],
})
export class DailyAttendanceModule {}
