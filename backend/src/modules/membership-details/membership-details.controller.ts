import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

import { UserRole } from '../users/enums/user-role.enum';

import { MembershipDetailsService } from './membership-details.service';

import { UpsertStudentDetailDto } from './dto/upsert-student-detail.dto';

import { UpsertTeacherDetailDto } from './dto/upsert-teacher-detail.dto';

@Controller('membership-details')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class MembershipDetailsController {
  constructor(private readonly service: MembershipDetailsService) {}

  @Get('students/:membershipId')
  getStudent(
    @Param('membershipId', ParseIntPipe)
    membershipId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.getStudent(membershipId, request.authUser);
  }

  @Put('students/:membershipId')
  upsertStudent(
    @Param('membershipId', ParseIntPipe)
    membershipId: number,
    @Body() dto: UpsertStudentDetailDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.upsertStudent(membershipId, dto, request.authUser);
  }

  @Get('teachers/:membershipId')
  getTeacher(
    @Param('membershipId', ParseIntPipe)
    membershipId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.getTeacher(membershipId, request.authUser);
  }

  @Put('teachers/:membershipId')
  upsertTeacher(
    @Param('membershipId', ParseIntPipe)
    membershipId: number,
    @Body() dto: UpsertTeacherDetailDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.upsertTeacher(membershipId, dto, request.authUser);
  }
}
