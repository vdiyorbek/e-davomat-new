import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { School } from '../schools/school.entity';
import { Terminal } from './terminal.entity';

import { TerminalCryptoService } from './terminal-crypto.service';
import { TerminalsService } from './terminals.service';
import { TerminalsController } from './terminals.controller';
import { HikvisionService } from './hikvision.service';
import { HikvisionEventsService } from './hikvision-events.service';
import { HikvisionPhotoService } from './hikvision-photo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Terminal, School])],
  controllers: [TerminalsController],
  providers: [
    TerminalCryptoService,
    TerminalsService,
    HikvisionEventsService,
    HikvisionService,
    HikvisionPhotoService,
  ],
  exports: [
    TerminalCryptoService,
    HikvisionEventsService,
    HikvisionPhotoService,
  ],
})
export class TerminalsModule {}
