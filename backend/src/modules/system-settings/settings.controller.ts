import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { IsDefined } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { SettingsService } from './settings.service';

class UpdateSettingDto {
  @IsDefined()
  value!: unknown;
}

function userIdOf(request: AuthenticatedRequest): number {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser.id;
}

@Controller('system-settings')
@Roles(UserRole.SUPER_ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.settings.list();
  }

  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.settings.history(limit);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settings.set(key, dto.value, userIdOf(request));
  }

  @Delete(':key')
  reset(@Param('key') key: string, @Req() request: AuthenticatedRequest) {
    return this.settings.reset(key, userIdOf(request));
  }
}
