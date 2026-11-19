import {
  Controller,
  Get,
  Header,
  MessageEvent,
  Param,
  ParseIntPipe,
  Req,
  Sse,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { LiveHubService } from './live-hub.service';
import { LiveService } from './live.service';

function userOf(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

function jpeg(buffer: Buffer): StreamableFile {
  return new StreamableFile(buffer, {
    type: 'image/jpeg',
    disposition: 'inline',
    length: buffer.length,
  });
}

@Controller('live')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly hub: LiveHubService,
  ) {}

  @Get('schools/:schoolId/terminals')
  @Header('Cache-Control', 'private, no-store')
  terminals(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.live.terminals(schoolId, userOf(request));
  }

  @Get('schools/:schoolId/summary')
  @Header('Cache-Control', 'private, no-store')
  summary(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.live.summary(schoolId, userOf(request));
  }

  @Get('schools/:schoolId/recent')
  @Header('Cache-Control', 'private, no-store')
  recent(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.live.recent(schoolId, userOf(request));
  }

  /** Server-Sent Events: har bir yangi o‘tish shu zahoti keladi. */
  @Sse('schools/:schoolId/stream')
  @Header('X-Accel-Buffering', 'no')
  async stream(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<Observable<MessageEvent>> {
    await this.live.assertSchool(schoolId, userOf(request));

    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.hub.subscribe(schoolId, (events) =>
        subscriber.next({ type: 'events', data: events }),
      );
      // Proxy ulanishni uzmasligi uchun.
      const ping = setInterval(
        () => subscriber.next({ type: 'ping', data: String(Date.now()) }),
        20_000,
      );
      subscriber.next({ type: 'ready', data: String(Date.now()) });

      return () => {
        clearInterval(ping);
        unsubscribe();
      };
    });
  }

  @Get('events/:eventId/photo')
  @Header('Cache-Control', 'private, max-age=3600')
  @Header('X-Content-Type-Options', 'nosniff')
  async eventPhoto(
    @Param('eventId') eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return jpeg(await this.live.eventPhoto(eventId, userOf(request)));
  }

  @Get('terminals/:terminalId/snapshot')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async snapshot(
    @Param('terminalId', ParseIntPipe) terminalId: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return jpeg(await this.live.snapshot(terminalId, userOf(request)));
  }
}
