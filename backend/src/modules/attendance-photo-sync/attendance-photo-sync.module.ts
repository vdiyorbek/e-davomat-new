import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Terminal } from '../terminals/terminal.entity';
import { TerminalsModule } from '../terminals/terminals.module';
import { AttendancePhotoRetentionService } from './attendance-photo-retention.service';
import { ATTENDANCE_PHOTO_QUEUE } from './attendance-photo-sync.constants';
import { AttendancePhotoSyncProcessor } from './attendance-photo-sync.processor';
import { AttendancePhotoSyncScheduler } from './attendance-photo-sync.scheduler';
import { PushPhotoResolverService } from './push-photo-resolver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Terminal]),
    AttendanceEventsModule,
    TerminalsModule,
    BullModule.registerQueue({
      name: ATTENDANCE_PHOTO_QUEUE,
    }),
  ],
  providers: [
    AttendancePhotoSyncProcessor,
    AttendancePhotoSyncScheduler,
    AttendancePhotoRetentionService,
    PushPhotoResolverService,
  ],
})
export class AttendancePhotoSyncModule {}
