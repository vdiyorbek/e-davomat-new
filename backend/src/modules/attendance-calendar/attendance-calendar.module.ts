import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { School } from '../schools/school.entity';

import { AttendanceCalendarRule } from './attendance-calendar-rule.entity';
import { AttendanceWeeklySchedule } from './attendance-weekly-schedule.entity';
import { AttendanceCalendarController } from './attendance-calendar.controller';
import { AttendanceCalendarService } from './attendance-calendar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceCalendarRule,
      AttendanceWeeklySchedule,
      School,
    ]),
  ],
  controllers: [AttendanceCalendarController],
  providers: [AttendanceCalendarService],
  exports: [AttendanceCalendarService],
})
export class AttendanceCalendarModule {}
