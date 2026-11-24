import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { ParentAdminService } from './parent-admin.service';
import { TelegramConfigService } from './telegram-config.service';

@Controller('parent-notify')
@Roles(UserRole.SUPER_ADMIN)
export class ParentAdminController {
  constructor(
    private readonly service: ParentAdminService,
    private readonly config: TelegramConfigService,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'private, no-store')
  getConfig() {
    return this.config.view();
  }

  @Put('config')
  saveConfig(
    @Body()
    body: { token?: unknown; publicUrl?: unknown; regenerateSecret?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser;
    if (!user) throw new UnauthorizedException();
    return this.config.save(body ?? {}, user.id);
  }

  @Delete('config/token')
  clearToken(@Req() request: AuthenticatedRequest) {
    const user = request.authUser;
    if (!user) throw new UnauthorizedException();
    return this.config.clearToken(user.id);
  }

  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status() {
    return this.service.status();
  }

  @Post('webhook/setup')
  @HttpCode(200)
  setup() {
    return this.service.setupWebhook();
  }

  @Get('schools')
  @Header('Cache-Control', 'private, no-store')
  schools() {
    return this.service.schools();
  }

  @Put('schools/:schoolId')
  saveSchool(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Body()
    body: { enabled?: unknown; absentTime?: unknown; graceMinutes?: unknown },
  ) {
    return this.service.saveSchool(schoolId, body ?? {});
  }

  @Get('messages')
  @Header('Cache-Control', 'private, no-store')
  messages() {
    return this.service.messages(50);
  }
}
