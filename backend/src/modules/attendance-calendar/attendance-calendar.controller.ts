import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { AttendanceCalendarService } from './attendance-calendar.service';
import { GetCalendarRulesDto } from './dto/get-calendar-rules.dto';
import { Body, Post } from '@nestjs/common';

import { AttendanceCalendarWriteService } from './attendance-calendar-write.service';
import { CreateCalendarRuleDto } from './dto/create-calendar-rule.dto';

@Controller('attendance-calendar')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class AttendanceCalendarController {
  constructor(
    private readonly calendarService: AttendanceCalendarService,
    private readonly calendarWriteService: AttendanceCalendarWriteService,
  ) {}

  @Get('rules')
  findRules(
    @Query() query: GetCalendarRulesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.calendarService.findRules(query, request.authUser);
  }

  @Post('rules')
  createRule(
    @Body() dto: CreateCalendarRuleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.calendarWriteService.createRule(dto, request.authUser);
  }
}
