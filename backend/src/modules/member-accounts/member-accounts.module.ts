import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';

import { SchoolMembership } from '../school-memberships/school-membership.entity';

import { UserPersonLink } from '../user-person-links/user-person-link.entity';

import { User } from '../users/user.entity';

import { MemberAccountsController } from './member-accounts.controller';

import { MemberAccountsService } from './member-accounts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Person,
      School,
      SchoolMembership,
      User,
      UserPersonLink,
    ]),
  ],
  controllers: [MemberAccountsController],
  providers: [MemberAccountsService],
})
export class MemberAccountsModule {}
