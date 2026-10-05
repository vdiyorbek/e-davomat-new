import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Terminal } from '../terminals/terminal.entity';

import { ATTENDANCE_PHOTO_QUEUE } from './attendance-photo-sync.constants';
import { AttendancePhotoSyncProcessor } from './attendance-photo-sync.processor';
import { AttendancePhotoSyncScheduler } from './attendance-photo-sync.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Terminal]),
    AttendanceEventsModule,
    BullModule.registerQueue({
      name: ATTENDANCE_PHOTO_QUEUE,
    }),
  ],
  providers: [AttendancePhotoSyncProcessor, AttendancePhotoSyncScheduler],
})
export class AttendancePhotoSyncModule {}
