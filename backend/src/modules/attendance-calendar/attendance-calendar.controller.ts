import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { AttendanceWeeklySchedulesService } from './attendance-weekly-schedules.service';
import { CreateWeeklyScheduleDto } from './dto/create-weekly-schedule.dto';
import { GetWeeklySchedulesDto } from './dto/get-weekly-schedules.dto';
import { UpdateWeeklyScheduleDto } from './dto/update-weekly-schedule.dto';

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
    private readonly weeklySchedulesService: AttendanceWeeklySchedulesService,
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

  @Get('weekly-schedules')
  findWeeklySchedules(
    @Query() query: GetWeeklySchedulesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.weeklySchedulesService.findAll(query, request.authUser);
  }

  @Post('weekly-schedules')
  createWeeklySchedule(
    @Body() dto: CreateWeeklyScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.weeklySchedulesService.create(dto, request.authUser);
  }

  @Patch('weekly-schedules/:id')
  updateWeeklySchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWeeklyScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.weeklySchedulesService.update(id, dto, request.authUser);
  }

  @Patch('rules/:id/cancel')
  cancelRule(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.calendarWriteService.cancelRule(id, request.authUser);
  }
}
