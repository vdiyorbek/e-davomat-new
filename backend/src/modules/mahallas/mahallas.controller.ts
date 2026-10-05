import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

import { MahallasService } from './mahallas.service';
import type { MahallaAccess } from './mahallas.service';
import { CreateMahallaDto } from './dto/create-mahalla.dto';
import { ListMahallasDto } from './dto/list-mahallas.dto';

@Controller('mahallas')
export class MahallasController {
  constructor(private readonly mahallasService: MahallasService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  create(@Body() dto: CreateMahallaDto, @Req() request: AuthenticatedRequest) {
    return this.mahallasService.create(dto, this.getUser(request));
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(@Query() dto: ListMahallasDto, @Req() request: AuthenticatedRequest) {
    return this.mahallasService.findAll(dto, this.getUser(request));
  }

  @Get('options')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findOptions(
    @Query() dto: ListMahallasDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.getUser(request);

    return this.mahallasService.findOptions(dto);
  }

  private getUser(request: AuthenticatedRequest): MahallaAccess {
    if (!request.authUser) {
      throw new UnauthorizedException('Tizimga kirish talab etiladi');
    }

    return request.authUser;
  }
}
