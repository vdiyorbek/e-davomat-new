import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import {
  GetInspectorAbsenteesQueryDto,
  GetInspectorCasesQueryDto,
  OpenInspectorCaseDto,
  UpdateInspectorCaseDto,
} from './dto/inspector-case.dto';
import { InspectorCasesService } from './inspector-cases.service';

function actorOf(request: AuthenticatedRequest): AuthenticatedUser {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

@Controller('inspectors/me')
@Roles(UserRole.MAHALLA_INSPECTOR)
export class InspectorCasesController {
  constructor(private readonly service: InspectorCasesService) {}

  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  summary(@Req() request: AuthenticatedRequest) {
    return this.service.summary(actorOf(request));
  }

  @Get('absentees')
  @Header('Cache-Control', 'private, no-store')
  absentees(
    @Query() query: GetInspectorAbsenteesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.absentees(query, actorOf(request));
  }

  @Get('cases')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() query: GetInspectorCasesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(query, actorOf(request));
  }

  @Post('cases')
  @Header('Cache-Control', 'private, no-store')
  open(
    @Body() dto: OpenInspectorCaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.open(dto.personId, actorOf(request));
  }

  @Get('cases/:id')
  @Header('Cache-Control', 'private, no-store')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.get(id, actorOf(request));
  }

  @Patch('cases/:id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectorCaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, actorOf(request));
  }

  @Post('cases/:id/close')
  @Header('Cache-Control', 'private, no-store')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectorCaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.close(id, dto, actorOf(request));
  }

  @Get('cases/:id/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async pdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const buffer = await this.service.pdf(id, actorOf(request));
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="hisobot-${id}.pdf"`,
      length: buffer.length,
    });
  }
}
