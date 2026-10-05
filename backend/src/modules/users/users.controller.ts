import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';

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
}
