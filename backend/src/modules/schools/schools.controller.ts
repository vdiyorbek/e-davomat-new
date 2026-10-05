import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { School } from './school.entity';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { GetSchoolsQueryDto } from './dto/get-schools-query.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Controller('schools')
@Roles(UserRole.SUPER_ADMIN)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetSchoolsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<School[]> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.schoolsService.findAll(query, user);
  }

  @Post()
  create(@Body() dto: CreateSchoolDto): Promise<School> {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSchoolDto,
  ): Promise<School> {
    return this.schoolsService.update(id, dto);
  }
}
