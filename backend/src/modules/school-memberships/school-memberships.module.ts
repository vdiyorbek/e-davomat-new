import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolClass } from '../classes/school-class.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { SchoolMembership } from './school-membership.entity';
import { SchoolMembershipsController } from './school-memberships.controller';
import { SchoolMembershipsService } from './school-memberships.service';
import { SchoolStudentsController } from './school-students.controller';
import { SchoolStudentsService } from './school-students.service';
import { StudentImportService } from './student-import.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolMembership,
      School,
      Mahalla,
      SchoolClass,
      Person,
    ]),
  ],
  controllers: [SchoolMembershipsController, SchoolStudentsController],
  providers: [
    SchoolMembershipsService,
    SchoolStudentsService,
    StudentImportService,
  ],
  exports: [SchoolMembershipsService],
})
export class SchoolMembershipsModule {}
