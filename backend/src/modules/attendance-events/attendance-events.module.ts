import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Terminal } from '../terminals/terminal.entity';
import { TerminalsModule } from '../terminals/terminals.module';

import { AttendanceEvent } from './attendance-event.entity';
import { AttendanceEventsController } from './attendance-events.controller';
import { AttendanceEventsService } from './attendance-events.service';
import { AttendanceEventPhotosService } from './attendance-event-photos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Terminal]),
    TerminalsModule,
  ],
  controllers: [AttendanceEventsController],
  providers: [AttendanceEventsService, AttendanceEventPhotosService],
  exports: [AttendanceEventsService, AttendanceEventPhotosService],
})
export class AttendanceEventsModule {}
