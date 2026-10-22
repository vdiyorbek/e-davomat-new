import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LessonSchedule } from './lesson-schedule.entity';
import { LessonSchedulesService } from './lesson-schedules.service';
import { LessonSchedulesController } from './lesson-schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LessonSchedule])],
  controllers: [LessonSchedulesController],
  providers: [LessonSchedulesService],
  exports: [LessonSchedulesService],
})
export class LessonSchedulesModule {}
