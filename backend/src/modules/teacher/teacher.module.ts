import { Module } from '@nestjs/common';

import { TextbooksModule } from '../textbooks/textbooks.module';
import { TeacherCabinetService } from './teacher-cabinet.service';
import { TeacherContextService } from './teacher-context.service';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';

@Module({
  imports: [TextbooksModule],
  controllers: [TeacherController],
  providers: [TeacherService, TeacherContextService, TeacherCabinetService],
  exports: [TeacherService, TeacherContextService],
})
export class TeacherModule {}
