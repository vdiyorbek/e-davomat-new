import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { TerminalsModule } from '../terminals/terminals.module';
import { LiveHubService } from './live-hub.service';
import { LivePeopleService } from './live-people.service';
import { LiveSnapshotService } from './live-snapshot.service';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

/** Real vaqt sahifasi: terminal kamerasi va o‘tayotganlar oqimi. */
@Module({
  imports: [RedisModule, TerminalsModule],
  controllers: [LiveController],
  providers: [
    LiveHubService,
    LivePeopleService,
    LiveSnapshotService,
    LiveService,
  ],
})
export class LiveModule {}
