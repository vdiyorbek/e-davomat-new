import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { EventCompactionController } from './event-compaction.controller';
import { EventCompactionService } from './event-compaction.service';

@Module({
  imports: [RedisModule],
  controllers: [EventCompactionController],
  providers: [EventCompactionService],
})
export class EventCompactionModule {}
