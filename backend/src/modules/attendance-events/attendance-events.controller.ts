import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

import { AttendanceEventsService } from './attendance-events.service';
import { SyncAttendanceEventsDto } from './dto/sync-attendance-events.dto';
import { AttendanceEventPhotosService } from './attendance-event-photos.service';
import { DownloadEventPhotosDto } from './dto/download-event-photos.dto';
import type { DownloadEventPhotosResponse } from './attendance-event-photos.service';

@Controller('attendance-events')
@Roles(UserRole.SUPER_ADMIN)
export class AttendanceEventsController {
  constructor(
    private readonly attendanceEventsService: AttendanceEventsService,
    private readonly attendanceEventPhotosService: AttendanceEventPhotosService,
  ) {}

  @Post('sync')
  @HttpCode(200)
  sync(@Body() dto: SyncAttendanceEventsDto) {
    return this.attendanceEventsService.sync(dto);
  }

  @Post('photos/download')
  @HttpCode(200)
  downloadPhotos(
    @Body() dto: DownloadEventPhotosDto,
  ): Promise<DownloadEventPhotosResponse> {
    return this.attendanceEventPhotosService.downloadPending(dto);
  }

  @Get('photos/stats')
  getPhotoStats() {
    return this.attendanceEventPhotosService.getPhotoStats();
  }

  @Post('photos/:terminalId/retry-missing')
  @HttpCode(200)
  retryMissingPhotos(@Param('terminalId', ParseIntPipe) terminalId: number) {
    return this.attendanceEventPhotosService.retryMissingPhotos(terminalId);
  }

  @Get('photos/:terminalId/issues')
  getPhotoIssues(
    @Param('terminalId', ParseIntPipe)
    terminalId: number,

    @Query('limit', new DefaultValuePipe(50), ParseIntPipe)
    limit: number,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit 1 dan 100 gacha bo‘lishi kerak');
    }

    return this.attendanceEventPhotosService.getPhotoIssues(terminalId, limit);
  }
}
