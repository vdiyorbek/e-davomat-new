import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { ATTENDANCE_PHOTO_QUEUE } from '../attendance-photo-sync/attendance-photo-sync.constants';
import { PERSON_SYNC_QUEUE } from '../terminals/person-sync.constants';
import { TERMINAL_SYNC_QUEUE } from '../terminal-sync/terminal-sync.constants';
import { SystemMonitorController } from './system-monitor.controller';
import { SystemMonitorScheduler } from './system-monitor.scheduler';
import { SystemMonitorService } from './system-monitor.service';

@Module({
  imports: [
    RedisModule,
    BullModule.registerQueue(
      { name: TERMINAL_SYNC_QUEUE },
      { name: PERSON_SYNC_QUEUE },
      { name: ATTENDANCE_PHOTO_QUEUE },
    ),
  ],
  controllers: [SystemMonitorController],
  providers: [SystemMonitorService, SystemMonitorScheduler],
})
export class SystemMonitorModule {}
