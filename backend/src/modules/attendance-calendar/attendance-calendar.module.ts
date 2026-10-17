import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';

import { AttendanceCalendarRule } from './attendance-calendar-rule.entity';
import { AttendanceWeeklySchedule } from './attendance-weekly-schedule.entity';

import { AttendanceCalendarController } from './attendance-calendar.controller';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceCalendarWriteService } from './attendance-calendar-write.service';
import { AttendanceWeeklySchedulesService } from './attendance-weekly-schedules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceCalendarRule,
      AttendanceWeeklySchedule,
      Region,
      District,
      School,
      SchoolClass,
    ]),
  ],
  controllers: [AttendanceCalendarController],
  providers: [
    AttendanceCalendarService,
    AttendanceCalendarWriteService,
    AttendanceWeeklySchedulesService,
  ],
  exports: [AttendanceCalendarService, AttendanceWeeklySchedulesService],
})
export class AttendanceCalendarModule {}
