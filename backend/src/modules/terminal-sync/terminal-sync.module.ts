import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import { TerminalSyncService } from './terminal-sync.service';
import { TerminalSyncProcessor } from './terminal-sync.processor';
import { TerminalSyncScheduler } from './terminal-sync.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Terminal]),

    AttendanceEventsModule,
    DailyAttendanceModule,

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

    BullModule.registerQueue({
      name: TERMINAL_SYNC_QUEUE,
    }),
  ],
  providers: [
    TerminalSyncService,
    TerminalSyncProcessor,
    TerminalSyncScheduler,
  ],
})
export class TerminalSyncModule {}
