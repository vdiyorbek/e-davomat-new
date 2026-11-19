import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { UpsertSchoolShiftsDto } from './dto/upsert-school-shifts.dto';
import { SchoolShiftsService } from './school-shifts.service';

@Controller('schools/:schoolId/shifts')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class SchoolShiftsController {
  constructor(private readonly service: SchoolShiftsService) {}

  @Get()
  list(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.list(schoolId, request.authUser);
  }

  @Put()
  upsert(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Body() dto: UpsertSchoolShiftsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.upsert(schoolId, dto, request.authUser);
  }
}
