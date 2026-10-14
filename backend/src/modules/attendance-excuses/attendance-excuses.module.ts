import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { AttendanceExcuse } from './attendance-excuse.entity';

import { AttendanceExcusesController } from './attendance-excuses.controller';
import { AttendanceExcusesService } from './attendance-excuses.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceExcuse, SchoolMembership])],
  controllers: [AttendanceExcusesController],
  providers: [AttendanceExcusesService],
  exports: [AttendanceExcusesService],
})
export class AttendanceExcusesModule {}
