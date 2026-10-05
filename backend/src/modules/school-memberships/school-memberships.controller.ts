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
import { SchoolMembership } from './school-membership.entity';
import { SchoolMembershipsService } from './school-memberships.service';
import type { SchoolMembershipsPage } from './school-memberships.service';
import { CreateSchoolMembershipDto } from './dto/create-school-membership.dto';
import { GetSchoolMembershipsQueryDto } from './dto/get-school-memberships-query.dto';
import { EndSchoolMembershipDto } from './dto/end-school-membership.dto';

@Controller('school-memberships')
@Roles(UserRole.SUPER_ADMIN)
export class SchoolMembershipsController {
  constructor(private readonly membershipsService: SchoolMembershipsService) {}

  @Post()
  create(@Body() dto: CreateSchoolMembershipDto): Promise<SchoolMembership> {
    return this.membershipsService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetSchoolMembershipsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SchoolMembershipsPage> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.membershipsService.findAll(query, user);
  }

  @Patch(':id/end')
  @Roles(UserRole.SUPER_ADMIN)
  endMembership(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EndSchoolMembershipDto,
  ): Promise<SchoolMembership> {
    return this.membershipsService.endMembership(id, dto);
  }
}
