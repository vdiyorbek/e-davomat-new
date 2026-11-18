
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';

import { HikvisionPushController } from './hikvision-push.controller';
import { HikvisionPushProcessor } from './hikvision-push.processor';
import { HIKVISION_PUSH_QUEUE } from './hikvision-push.types';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terminal,
      AttendanceEvent,
    ]),

    BullModule.registerQueueAsync({
      name: HIKVISION_PUSH_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => {
        const port = Number(
          config.getOrThrow<string>('REDIS_PORT'),
        );

        if (
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535
        ) {
          throw new Error('REDIS_PORT noto‘g‘ri');
        }

        return {
          prefix: 'edavomat-jobs',

          connection: {
            host: config.getOrThrow<string>('REDIS_HOST'),
            port,

            username:
              config.get<string>('REDIS_USERNAME') ||
              undefined,

            password:
              config.get<string>('REDIS_PASSWORD') ||
              undefined,

            maxRetriesPerRequest: null,

            connectTimeout: 10000,
          },

          defaultJobOptions: {
            attempts: 5,

            backoff: {
              type: 'exponential' as const,
              delay: 2000,
            },

            removeOnComplete: {
              age: 86400,
              count: 100000,
            },

            removeOnFail: false,
          },
        };
      },
    }),
  ],

  controllers: [
    HikvisionPushController,
  ],

  providers: [
    HikvisionPushProcessor,
  ],
})
export class HikvisionPushModule { }
