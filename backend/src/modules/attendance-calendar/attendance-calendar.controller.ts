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

@Controller('attendance-calendar')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class AttendanceCalendarController {
  constructor(private readonly calendarService: AttendanceCalendarService) {}

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
}
