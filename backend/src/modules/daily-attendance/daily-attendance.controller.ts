import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DailyAttendanceExportService } from './daily-attendance-export.service';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { DailyAttendanceService } from './daily-attendance.service';
import { DailyAttendanceReadService } from './daily-attendance-read.service';

import { RebuildDailyAttendanceDto } from './dto/rebuild-daily-attendance.dto';
import { GetDailyAttendanceQueryDto } from './dto/get-daily-attendance-query.dto';

@Controller('daily-attendance')
@Roles(UserRole.SUPER_ADMIN)
export class DailyAttendanceController {
  constructor(
    private readonly dailyAttendanceService: DailyAttendanceService,
    private readonly dailyAttendanceReadService: DailyAttendanceReadService,
    private readonly exportService: DailyAttendanceExportService,
  ) {}

  @Post('rebuild')
  @HttpCode(200)
  rebuild(@Body() dto: RebuildDailyAttendanceDto) {
    return this.dailyAttendanceService.rebuild(dto);
  }

  @Get('export')
  @Header('Cache-Control', 'private, no-store')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  async exportExcel(
    @Query() query: GetDailyAttendanceQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    await this.exportService.exportExcel(query, request.authUser, response);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetDailyAttendanceQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.dailyAttendanceReadService.findAll(query, request.authUser);
  }

  @Get(':id/photos/:direction')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  async photo(
    @Param('id') id: string,
    @Param('direction') direction: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    const buffer = await this.dailyAttendanceReadService.readPhoto(
      id,
      direction,
      request.authUser,
    );

    return new StreamableFile(buffer, {
      type: 'image/jpeg',
      disposition: 'inline',
      length: buffer.length,
    });
  }
}
