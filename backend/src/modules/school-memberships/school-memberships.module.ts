import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolMembership } from './school-membership.entity';
import { SchoolMembershipsController } from './school-memberships.controller';
import { SchoolMembershipsService } from './school-memberships.service';
import { SchoolStudentsController } from './school-students.controller';
import { SchoolStudentsService } from './school-students.service';
@Module({
  imports: [TypeOrmModule.forFeature([SchoolMembership])],
  controllers: [SchoolMembershipsController, SchoolStudentsController],
  providers: [SchoolMembershipsService, SchoolStudentsService],
  exports: [SchoolMembershipsService],
})
export class SchoolMembershipsModule {}
