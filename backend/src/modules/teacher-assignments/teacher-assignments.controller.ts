import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { TeacherAssignmentsService } from './teacher-assignments.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { ListTeacherAssignmentsDto } from './dto/list-teacher-assignments.dto';
import { UpdateWeeklyHoursDto } from './dto/update-weekly-hours.dto';

@Controller('teacher-assignments')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class TeacherAssignmentsController {
  constructor(private readonly service: TeacherAssignmentsService) {}

  /** O‘quv rejasi bo‘yicha haftalik soat (yuklama hisobi uchun). */
  @Patch(':id/weekly-hours')
  setWeeklyHours(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWeeklyHoursDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.setWeeklyHours(id, dto.weeklyHours, request.authUser);
  }

  @Get()
  findAll(
    @Query() dto: ListTeacherAssignmentsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.findAll(dto, request.authUser);
  }

  @Post()
  create(
    @Body() dto: CreateTeacherAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.create(dto, request.authUser);
  }
}
