import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { SchoolStudentsService } from './school-students.service';
import type { CreatedSchoolStudent } from './school-students.service';

@Controller('school-students')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class SchoolStudentsController {
  constructor(private readonly studentsService: SchoolStudentsService) {}

  @Post()
  create(
    @Body() dto: CreateSchoolStudentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreatedSchoolStudent> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.studentsService.create(dto, user);
  }
}
