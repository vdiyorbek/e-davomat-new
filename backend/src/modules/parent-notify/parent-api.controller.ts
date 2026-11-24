import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { ParentApiService } from './parent-api.service';
import { TelegramInitDataGuard } from './telegram-init-data.guard';
import type { ParentLink, ParentRequest } from './telegram-init-data.guard';

function linkOf(request: ParentRequest): ParentLink {
  if (!request.parentLink) throw new Error('parentLink yo‘q');
  return request.parentLink;
}

/** Telegram Mini App uchun. Autentifikatsiya: `X-Telegram-Init-Data` imzosi. */
@Public()
@UseGuards(TelegramInitDataGuard)
@Controller('parent')
export class ParentApiController {
  constructor(private readonly service: ParentApiService) {}

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  me(@Req() request: ParentRequest) {
    return this.service.me(linkOf(request));
  }

  @Patch('me')
  update(
    @Req() request: ParentRequest,
    @Body()
    body: {
      language?: unknown;
      arrival?: unknown;
      leave?: unknown;
      absent?: unknown;
      excuse?: unknown;
    },
  ) {
    return this.service.updateMe(linkOf(request), body ?? {});
  }

  @Get('children/:personId/attendance')
  @Header('Cache-Control', 'private, no-store')
  attendance(
    @Req() request: ParentRequest,
    @Param('personId', ParseIntPipe) personId: number,
    @Query('month') month?: string,
  ) {
    return this.service.monthAttendance(linkOf(request), personId, month);
  }

  @Get('children/:personId/excuses')
  @Header('Cache-Control', 'private, no-store')
  excuses(
    @Req() request: ParentRequest,
    @Param('personId', ParseIntPipe) personId: number,
  ) {
    return this.service.excuses(linkOf(request), personId);
  }
}
