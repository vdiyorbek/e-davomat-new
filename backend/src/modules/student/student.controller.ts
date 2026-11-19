import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { StudentCabinetService } from './student-cabinet.service';

function userOf(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

@Controller('student/me')
@Roles(UserRole.STUDENT)
export class StudentController {
  constructor(private readonly cabinet: StudentCabinetService) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  overview(@Req() request: AuthenticatedRequest) {
    return this.cabinet.overview(userOf(request));
  }

  @Get('schedule')
  @Header('Cache-Control', 'private, no-store')
  schedule(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cabinet.schedule(userOf(request), from, to);
  }

  @Get('attendance')
  @Header('Cache-Control', 'private, no-store')
  attendance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cabinet.attendance(userOf(request), from, to);
  }
}
