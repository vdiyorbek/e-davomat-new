import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { NotificationsService } from './notifications.service';

/** Har bir tizimga kirgan foydalanuvchi faqat o‘z bildirishnomalarini ko‘radi. */
@Controller('notifications')
@Roles(...Object.values(UserRole))
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private userId(request: AuthenticatedRequest): number {
    if (!request.authUser) throw new UnauthorizedException();
    return request.authUser.id;
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    const userId = this.userId(request);
    const size = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const [items, unreadCount] = await Promise.all([
      this.notifications.list(userId, size, unread === 'true'),
      this.notifications.unreadCount(userId),
    ]);
    return { items, unreadCount };
  }

  @Get('unread-count')
  @Header('Cache-Control', 'private, no-store')
  async unreadCount(@Req() request: AuthenticatedRequest) {
    return {
      unreadCount: await this.notifications.unreadCount(this.userId(request)),
    };
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.notifications.markAllRead(this.userId(request));
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.notifications.markRead(this.userId(request), id);
  }
}
