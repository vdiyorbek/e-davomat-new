import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Get,
  Query,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { GetUsersQueryDto } from './dto/get-users-query.dto';

@Controller('users')
@Roles(UserRole.SUPER_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/access')
  updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserAccessDto,
  ) {
    return this.usersService.updateAccess(id, dto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.findAll(query, currentUser);
  }
}
