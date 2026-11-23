import {
  Body,
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
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  DataGapsQueryDto,
  ListAnnouncementsQueryDto,
  NotifyGapsDto,
} from './dto/create-announcement.dto';

function actorOf(request: AuthenticatedRequest): AuthenticatedUser {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  create(
    @Body() dto: CreateAnnouncementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, actorOf(request));
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() query: ListAnnouncementsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(actorOf(request), query.page, query.limit);
  }

  /** Kamchiligi bor maktablar (rasmi/ota-ona telefoni yo‘q o‘quvchilar). */
  @Get('data-gaps')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  dataGaps(
    @Query() query: DataGapsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.dataGaps(actorOf(request), query.regionId);
  }

  /** Maktab administratorlariga kamchilik bo‘yicha avtomatik topshiriq yuboradi. */
  @Post('data-gaps/notify')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  notifyGaps(@Body() dto: NotifyGapsDto, @Req() request: AuthenticatedRequest) {
    return this.service.notifyGaps(
      actorOf(request),
      dto.gap,
      dto.schoolIds,
      dto.regionId,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.detail(id, actorOf(request));
  }

  /** Qabul qiluvchi topshiriqni bajarilgan deb belgilaydi. */
  @Post(':id/done')
  @HttpCode(204)
  @Roles(...Object.values(UserRole))
  async done(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.markDone(id, actorOf(request).id);
  }
}
