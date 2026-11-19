import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { DashboardService } from './dashboard.service';
import {
  BackfillStatsDto,
  DashboardDayDto,
  DashboardStreaksDto,
  DashboardTrendDto,
  UpdateGeoKeyDto,
  UpdateLateThresholdDto,
} from './dto/dashboard-query.dto';

const ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
];

function userOf(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

@Controller('dashboard')
@Roles(...ADMINS)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  overview(
    @Query() query: DashboardDayDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.overview(userOf(request), query);
  }

  @Get('trend')
  @Header('Cache-Control', 'private, no-store')
  trend(
    @Query() query: DashboardTrendDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.trend(userOf(request), query);
  }

  @Get('arrivals')
  @Header('Cache-Control', 'private, no-store')
  arrivals(
    @Query() query: DashboardDayDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.arrivals(userOf(request), query);
  }

  @Get('absence-streaks')
  @Header('Cache-Control', 'private, no-store')
  streaks(
    @Query() query: DashboardStreaksDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.streaks(userOf(request), query);
  }

  @Get('geo-units')
  @Roles(UserRole.SUPER_ADMIN)
  geoUnits() {
    return this.service.geoUnits();
  }

  @Put('geo-keys')
  @Roles(UserRole.SUPER_ADMIN)
  updateGeoKey(@Body() dto: UpdateGeoKeyDto) {
    return this.service.updateGeoKey(dto.level, dto.id, dto.geoKey ?? null);
  }

  /** Tarixiy kunlar statistikasini hisoblash (birinchi o‘rnatishda). */
  @Post('stats/backfill')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(202)
  backfill(@Body() dto: BackfillStatsDto) {
    return this.service.backfill(dto.from, dto.to);
  }
}

/** Kechikish chegarasi: maktab admini o‘zi; yuqori adminlar ko‘radi va o‘zgartira oladi. */
@Controller('schools/:schoolId/attendance-settings')
@Roles(...ADMINS)
export class SchoolAttendanceSettingsController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  get(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.getLateSettings(userOf(request), schoolId);
  }

  @Put()
  update(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Body() dto: UpdateLateThresholdDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateLateSettings(
      userOf(request),
      schoolId,
      dto.lateThresholdMinutes,
    );
  }
}
