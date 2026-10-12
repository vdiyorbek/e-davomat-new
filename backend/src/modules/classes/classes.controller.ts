import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ClassesService } from './classes.service';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { ListSchoolClassesDto } from './dto/list-school-classes.dto';
import { Req, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('classes')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  create(
    @Body() dto: CreateSchoolClassDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.classesService.create(dto, user);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() dto: ListSchoolClassesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.classesService.findAll(dto, user);
  }
}
