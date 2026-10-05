import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolMembership } from './school-membership.entity';
import { SchoolMembershipsController } from './school-memberships.controller';
import { SchoolMembershipsService } from './school-memberships.service';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolMembership])],
  controllers: [SchoolMembershipsController],
  providers: [SchoolMembershipsService],
  exports: [SchoolMembershipsService],
})
export class SchoolMembershipsModule {}
