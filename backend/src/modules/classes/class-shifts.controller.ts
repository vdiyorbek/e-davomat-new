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

import { ClassShiftsService } from './class-shifts.service';
import {
  AssignClassShiftDto,
  AssignClassShiftsDto,
} from './dto/assign-class-shifts.dto';

@Controller('classes')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class ClassShiftsController {
  constructor(private readonly service: ClassShiftsService) {}

  /** Bir nechta sinfni birdaniga 1- yoki 2-smenaga o‘tkazish. */
  @Put('shifts')
  assignMany(
    @Body() dto: AssignClassShiftsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.assignMany(dto, request.authUser);
  }

  @Get(':id/shifts')
  history(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.history(id, request.authUser);
  }

  @Put(':id/shifts')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignClassShiftDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.service.assign(id, dto, request.authUser);
  }
}
