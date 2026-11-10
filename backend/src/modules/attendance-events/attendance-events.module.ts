import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '../../redis/redis.module';

import { Terminal } from '../terminals/terminal.entity';
import { TerminalsModule } from '../terminals/terminals.module';

import { AttendanceEvent } from './attendance-event.entity';
import { AttendanceEventsController } from './attendance-events.controller';
import { AttendanceEventsService } from './attendance-events.service';
import { AttendanceEventPhotosService } from './attendance-event-photos.service';
import { EventSyncTerminalLockService } from './event-sync-terminal-lock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Terminal]),

    TerminalsModule,
    RedisModule,
  ],

  controllers: [AttendanceEventsController],

  providers: [
    AttendanceEventsService,
    AttendanceEventPhotosService,
    EventSyncTerminalLockService,
  ],

  exports: [
    AttendanceEventsService,
    AttendanceEventPhotosService,
    EventSyncTerminalLockService,
  ],
})
export class AttendanceEventsModule {}
