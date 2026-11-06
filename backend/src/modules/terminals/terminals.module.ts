import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { School } from '../schools/school.entity';
import { Terminal } from './terminal.entity';
import { TerminalPersonSync } from './terminal-person-sync.entity';
import { TerminalCryptoService } from './terminal-crypto.service';
import { TerminalsService } from './terminals.service';
import { TerminalsController } from './terminals.controller';
import { HikvisionService } from './hikvision.service';
import { HikvisionEventsService } from './hikvision-events.service';
import { HikvisionPhotoService } from './hikvision-photo.service';
import { SchoolMembership } from '../school-memberships/school-membership.entity';

import { Person } from '../persons/person.entity';
import { PersonSyncService } from './person-sync.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terminal,
      School,
      Person,
      SchoolMembership,
      TerminalPersonSync,
    ]),
  ],
  controllers: [TerminalsController],
  providers: [
    TerminalCryptoService,
    TerminalsService,
    HikvisionEventsService,
    HikvisionService,
    HikvisionPhotoService,
    PersonSyncService,
  ],
  exports: [
    TerminalCryptoService,
    HikvisionEventsService,
    HikvisionPhotoService,
    PersonSyncService,
  ],
})
export class TerminalsModule {}
