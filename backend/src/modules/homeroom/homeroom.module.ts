import { Module } from '@nestjs/common';

import { AttendanceExcusesModule } from '../attendance-excuses/attendance-excuses.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';
import { TeacherModule } from '../teacher/teacher.module';
import { HomeroomController } from './homeroom.controller';
import { HomeroomService } from './homeroom.service';

@Module({
  imports: [TeacherModule, DailyAttendanceModule, AttendanceExcusesModule],
  controllers: [HomeroomController],
  providers: [HomeroomService],
})
export class HomeroomModule {}
