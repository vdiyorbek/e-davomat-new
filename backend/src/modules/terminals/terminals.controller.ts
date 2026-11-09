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
  BadRequestException,
  Patch,
} from '@nestjs/common';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
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

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTerminalDto,
  ) {
    return this.terminalsService.update(id, dto);
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

  @Get(':id/person-sync/persons/:personId/check')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  checkTerminalPerson(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.checkTerminalPerson(
      id,
      personId,
      request.authUser,
    );
  }

  @Get(':id/person-sync/persons/:personId/face-check')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  checkPersonFace(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.checkTerminalPersonFace(
      id,
      personId,
      request.authUser,
    );
  }

  @Get(':id/person-sync/persons/:personId/plan')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getPersonSyncPlan(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.getPersonSyncPlan(
      id,
      personId,
      request.authUser,
    );
  }

  @Get(':id/person-sync/missing-teachers')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  getMissingTeachers(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.getMissingTeachers(id, request.authUser);
  }

  @Get(':id/person-sync/persons/:personId/photo-ready')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  checkPersonPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.checkPersonPhoto(
      id,
      personId,
      request.authUser,
    );
  }

  @Post(':id/person-sync/persons/:personId/sync')
  @Roles(UserRole.SUPER_ADMIN)
  syncTerminalPerson(
    @Param('id', ParseIntPipe) id: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.personSyncService.syncPerson(id, personId, request.authUser);
  }

  @Post(':id/person-sync/teachers/batch')
  @Roles(UserRole.SUPER_ADMIN)
  syncTeachersBatch(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    const input =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') {
      throw new BadRequestException('dryRun boolean bo‘lishi kerak');
    }

    if (
      input.limit !== undefined &&
      (typeof input.limit !== 'number' ||
        !Number.isInteger(input.limit) ||
        input.limit < 1 ||
        input.limit > 5)
    ) {
      throw new BadRequestException('limit 1 dan 5 gacha bo‘lishi kerak');
    }

    const dryRun = input.dryRun !== false;
    const limit = typeof input.limit === 'number' ? input.limit : 1;

    // Haqiqiy guruhli yuklash faqat
    // aniq tasdiqlash qiymati bilan ruxsat etiladi.
    if (!dryRun && input.confirm !== 'SYNC_TEACHERS') {
      throw new BadRequestException(
        'Yuklash uchun confirm: SYNC_TEACHERS kerak',
      );
    }

    return this.personSyncService.syncMissingTeachersBatch(
      id,
      request.authUser,
      {
        dryRun,
        limit,
      },
    );
  }
}
