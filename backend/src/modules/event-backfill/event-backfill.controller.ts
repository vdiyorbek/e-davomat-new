import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { EventBackfillService } from './event-backfill.service';

class BackfillDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

@Controller('terminals/:terminalId/events-backfill')
@Roles(UserRole.SUPER_ADMIN)
export class EventBackfillController {
  constructor(private readonly backfill: EventBackfillService) {}

  @Post()
  @HttpCode(202)
  start(
    @Param('terminalId', ParseIntPipe) terminalId: number,
    @Body() dto: BackfillDto,
  ) {
    return this.backfill.start(terminalId, dto.from, dto.to);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  status(@Param('terminalId', ParseIntPipe) terminalId: number) {
    return this.backfill.status(terminalId);
  }
}
