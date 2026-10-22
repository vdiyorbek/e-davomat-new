import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { LessonSchedulesService } from './lesson-schedules.service';
import { CreateLessonScheduleDto } from './dto/create-lesson-schedule.dto';
import { ListLessonSchedulesDto } from './dto/list-lesson-schedules.dto';
import { CancelLessonScheduleDto } from './dto/cancel-lesson-schedule.dto';
@Controller('lesson-schedules')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class LessonSchedulesController {
  constructor(private readonly service: LessonSchedulesService) {}

  @Post()
  create(
    @Body() dto: CreateLessonScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.create(dto, request.authUser);
  }

  @Get()
  findAll(
    @Query() dto: ListLessonSchedulesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.findAll(dto, request.authUser);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: CancelLessonScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.remove(id, dto.effectiveDate, request.authUser);
  }
}
