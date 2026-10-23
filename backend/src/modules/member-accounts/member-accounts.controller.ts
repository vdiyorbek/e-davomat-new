import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

import { UserRole } from '../users/enums/user-role.enum';

import { CreateMemberAccountDto } from './dto/create-member-account.dto';

import { MemberAccountsService } from './member-accounts.service';

@Controller('member-accounts')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class MemberAccountsController {
  constructor(private readonly service: MemberAccountsService) {}

  @Get('membership/:membershipId')
  status(
    @Param('membershipId', ParseIntPipe)
    membershipId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.status(membershipId, request.authUser);
  }

  @Post()
  create(
    @Body() dto: CreateMemberAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.create(dto, request.authUser);
  }
}
