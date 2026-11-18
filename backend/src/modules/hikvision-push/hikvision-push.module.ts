import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { HikvisionPushController } from './hikvision-push.controller';
import { HikvisionPushProcessor } from './hikvision-push.processor';
import { HIKVISION_PUSH_QUEUE } from './hikvision-push.types';

@Module({
  imports: [
    TypeOrmModule.forFeature([Terminal, AttendanceEvent]),
    BullModule.registerQueue({ name: HIKVISION_PUSH_QUEUE }),
  ],
  controllers: [HikvisionPushController],
  providers: [HikvisionPushProcessor],
})
export class HikvisionPushModule {}
