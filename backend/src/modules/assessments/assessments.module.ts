import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentModule } from '../student/student.module';
import { TeacherModule } from '../teacher/teacher.module';
import { TextbooksModule } from '../textbooks/textbooks.module';
import { AiTestGeneratorService } from './ai-test-generator.service';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { AssessmentAttemptsService } from './assessment-attempts.service';
import { AssessmentQuestion } from './assessment-question.entity';
import { Assessment } from './assessment.entity';
import { StudentAssessmentsController } from './student-assessments.controller';
import { StudentAssessmentsService } from './student-assessments.service';
import { TeacherAssessmentsController } from './teacher-assessments.controller';
import { TeacherAssessmentsService } from './teacher-assessments.service';

/** CHSB/BSB: AI bilan test tuzish, onlayn topshirish va baholash. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assessment,
      AssessmentQuestion,
      AssessmentAttempt,
    ]),
    TeacherModule,
    StudentModule,
    TextbooksModule,
  ],
  controllers: [TeacherAssessmentsController, StudentAssessmentsController],
  providers: [
    AiTestGeneratorService,
    AssessmentAttemptsService,
    TeacherAssessmentsService,
    StudentAssessmentsService,
  ],
})
export class AssessmentsModule {}
