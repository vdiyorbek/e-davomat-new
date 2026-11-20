import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { EventActivityController } from './event-activity.controller';
import { EventActivityRecorder } from './event-activity.recorder';

@Module({
  imports: [RedisModule],
  controllers: [EventActivityController],
  providers: [EventActivityRecorder],
  exports: [EventActivityRecorder],
})
export class EventActivityModule {}
