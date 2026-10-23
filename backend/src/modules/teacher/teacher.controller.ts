import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { TeacherService } from './teacher.service';

@Controller('teacher')
@Roles(UserRole.TEACHER)
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('me/assignments')
  myAssignments(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.myAssignments(request.authUser);
  }
}
