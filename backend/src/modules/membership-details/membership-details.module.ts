import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentMembershipDetail } from './student-membership-detail.entity';

import { TeacherMembershipDetail } from './teacher-membership-detail.entity';

import { MembershipDetailsService } from './membership-details.service';

import { MembershipDetailsController } from './membership-details.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentMembershipDetail,
      TeacherMembershipDetail,
    ]),
  ],
  controllers: [MembershipDetailsController],
  providers: [MembershipDetailsService],
  exports: [MembershipDetailsService],
})
export class MembershipDetailsModule {}
