import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LessonSession } from './lesson-session.entity';
import { LessonSessionsService } from './lesson-sessions.service';
import { LessonSessionsController } from './lesson-sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LessonSession])],
  controllers: [LessonSessionsController],
  providers: [LessonSessionsService],
  exports: [LessonSessionsService],
})
export class LessonSessionsModule {}
