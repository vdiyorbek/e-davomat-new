import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PersonSyncHistoryController } from './person-sync-history.controller';
import { Terminal } from '../terminals/terminal.entity';
import { TerminalsModule } from '../terminals/terminals.module';
import { TerminalPersonSyncCheck } from './terminal-person-sync-check.entity';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';
import { RedisModule } from '../../redis/redis.module';
import { User } from '../users/user.entity';
import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import { PERSON_SYNC_QUEUE } from '../terminals/person-sync.constants';
import { PersonSyncTerminalLockService } from './person-sync-terminal-lock.service';
import { TerminalSyncService } from './terminal-sync.service';
import { TerminalSyncProcessor } from './terminal-sync.processor';
import { TerminalSyncScheduler } from './terminal-sync.scheduler';
import { PersonSyncMonitoringService } from './person-sync-monitoring.service';
import { PersonSyncProcessor } from './person-sync.processor';
import { PersonSyncScheduler } from './person-sync.scheduler';
import { PersonSyncQueueController } from './person-sync-queue.controller';
import { TerminalSyncMonitoringController } from './terminal-sync-monitoring.controller';
import { TerminalSyncHistoryCleanupService } from './terminal-sync-history-cleanup.service';
import { TerminalSyncRun } from './terminal-sync-run.entity';
import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { BulkPersonSyncController } from './bulk-person-sync.controller';
import { PersonSyncBatch } from './person-sync-batch.entity';
import { PersonSyncBatchItem } from './person-sync-batch-item.entity';
import { PersonSyncHistoryService } from './person-sync-history.service';
import { PersonSyncReconciliationService } from './person-sync-reconciliation.service';
import { PersonSyncDispatcherService } from './person-sync-dispatcher.service';
import { TerminalClearRun } from './terminal-clear-run.entity';
import { TerminalClearHistoryService } from './terminal-clear-history.service';
import { TerminalClearHistoryController } from './terminal-clear-history.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terminal,
      TerminalPersonSyncCheck,
      TerminalSyncRun,
      SchoolMembership,
      User,
      PersonSyncBatch,
      PersonSyncBatchItem,
      TerminalClearRun,
    ]),

    // PersonSyncService shu moduldan export qilinadi.
    TerminalsModule,

    AttendanceEventsModule,
    DailyAttendanceModule,
    RedisModule,

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = Number(config.getOrThrow<string>('REDIS_PORT'));

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('REDIS_PORT noto‘g‘ri');
        }

        return {
          prefix: 'edavomat-jobs',
          connection: {
            host: config.getOrThrow<string>('REDIS_HOST'),
            port,
            username: config.get<string>('REDIS_USERNAME') || undefined,
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    BullModule.registerQueue(
      {
        name: TERMINAL_SYNC_QUEUE,
      },
      {
        name: PERSON_SYNC_QUEUE,
      },
    ),
  ],

  controllers: [
    PersonSyncQueueController,
    TerminalSyncMonitoringController,
    BulkPersonSyncController,
    PersonSyncHistoryController,
    TerminalClearHistoryController,
  ],

  providers: [
    TerminalSyncService,
    TerminalSyncProcessor,
    TerminalSyncScheduler,
    PersonSyncMonitoringService,
    PersonSyncProcessor,
    PersonSyncScheduler,
    PersonSyncTerminalLockService,
    TerminalSyncHistoryCleanupService,
    PersonSyncHistoryService,
    PersonSyncReconciliationService,
    PersonSyncDispatcherService,
    TerminalClearHistoryService,
  ],
})
export class TerminalSyncModule {}
