import { Module } from '@nestjs/common';

import { ClassesModule } from '../classes/classes.module';
import { TeacherModule } from '../teacher/teacher.module';
import { StudentCabinetService } from './student-cabinet.service';
import { StudentContextService } from './student-context.service';
import { StudentController } from './student.controller';

/** O‘quvchi kabineti: bugungi darslar, uy vazifasi, davomat. */
@Module({
  imports: [TeacherModule, ClassesModule],
  controllers: [StudentController],
  providers: [StudentContextService, StudentCabinetService],
  exports: [StudentContextService],
})
export class StudentModule {}
