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
import { PersonSyncService } from './person-sync.service';

@Controller('terminals')
@Roles(UserRole.SUPER_ADMIN)
export class TerminalsController {
  constructor(
    private readonly terminalsService: TerminalsService,
    private readonly personSyncService: PersonSyncService,
  ) {}

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

  @Get('monitoring')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  monitoring(
    @Query() query: GetTerminalsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.monitoring(query, request.authUser);
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

  @Get(':id/time')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalTime(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalTime(id, request.authUser);
  }

  @Post(':id/time/sync')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  syncTerminalTime(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.syncTerminalTime(id, request.authUser);
  }

  @Get(':id/person-sync/preview')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getPersonSyncPreview(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getPersonSyncPreview(id, request.authUser);
  }

  @Get(':id/person-sync/count')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalPersonsCount(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalPersonsCount(id, request.authUser);
  }

  @Get(':id/person-sync/compare')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  compareTerminalPersons(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.compareTerminalPersons(id, request.authUser);
  }

  @Get(':id/person-sync/capacity')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalPersonCapacity(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalPersonCapacity(
      id,
      request.authUser,
    );
  }

  @Get(':id/person-sync/face-count')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalFaceCount(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalFaceCount(id, request.authUser);
  }

  @Get(':id/person-sync/photo-check')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  checkMissingPersonsPhotos(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.checkMissingPersonsPhotos(
      id,
      request.authUser,
    );
  }

  @Get(':id/person-sync/face-libraries')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalFaceLibraries(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalFaceLibraries(id, request.authUser);
  }

  @Get(':id/person-sync/face-mode')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getTerminalFaceMode(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.terminalsService.getTerminalFaceMode(id, request.authUser);
  }

  @Get(':id/person-sync/persons/:personId/preview')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  previewPersonSync(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.previewPerson(id, personId, request.authUser);
  }
}
