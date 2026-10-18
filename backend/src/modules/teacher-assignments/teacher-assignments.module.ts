import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeacherClassSubject } from './teacher-class-subject.entity';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TeacherAssignmentsController } from './teacher-assignments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherClassSubject])],
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService],
  exports: [TeacherAssignmentsService],
})
export class TeacherAssignmentsModule {}
