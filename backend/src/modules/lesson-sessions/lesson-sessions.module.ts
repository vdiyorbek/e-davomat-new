import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LessonSession } from './lesson-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LessonSession])],
  exports: [TypeOrmModule],
})
export class LessonSessionsModule {}
