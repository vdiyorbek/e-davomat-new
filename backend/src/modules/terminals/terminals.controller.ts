import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  HttpCode,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { CreateTerminalDto } from './dto/create-terminal.dto';
import { GetTerminalsQueryDto } from './dto/get-terminals-query.dto';
import { TerminalsService } from './terminals.service';
import { StartTerminalSyncDto } from './dto/start-terminal-sync.dto';

@Controller('terminals')
@Roles(UserRole.SUPER_ADMIN)
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post()
  create(@Body() dto: CreateTerminalDto) {
    return this.terminalsService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetTerminalsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.findAll(query, request.authUser);
  }

  @Post(':id/check')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  checkConnection(@Param('id', ParseIntPipe) id: number) {
    return this.terminalsService.checkConnection(id);
  }

  @Post(':id/sync/start')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  startSync(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartTerminalSyncDto,
  ) {
    return this.terminalsService.startSync(id, dto);
  }
}
