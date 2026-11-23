import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminalStatusHistoryService } from './terminal-status-history.service';
import { TerminalDiagnosticsService } from './terminal-diagnostics.service';
import { TerminalCompareJobService } from './terminal-compare-job.service';
import { TerminalStatusPeriod } from './terminal-status-period.entity';
import { School } from '../schools/school.entity';
import { Terminal } from './terminal.entity';
import { TerminalPersonSync } from './terminal-person-sync.entity';
import { TerminalCryptoService } from './terminal-crypto.service';
import { TerminalConfigAuditService } from './terminal-config-audit.service';
import { TerminalsService } from './terminals.service';
import { TerminalsController } from './terminals.controller';
import { HikvisionService } from './hikvision.service';
import { HikvisionEventsService } from './hikvision-events.service';
import { HikvisionPhotoService } from './hikvision-photo.service';
import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { TerminalHealthScheduler } from './terminal-health.scheduler';
import { Person } from '../persons/person.entity';
import { PersonSyncService } from './person-sync.service';
import { BulkTerminalManagementController } from './bulk-terminal-management.controller';
import { BulkTerminalStatusController } from './bulk-terminal-status.controller';
import { TerminalPushController } from './terminal-push.controller';
import { TerminalPushCredentialsService } from './terminal-push-credentials.service';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terminal,
      School,
      Person,
      SchoolMembership,
      TerminalPersonSync,
      TerminalStatusPeriod,
    ]),
    RedisModule,
  ],
  controllers: [
    TerminalsController,
    BulkTerminalManagementController,
    BulkTerminalStatusController,
    TerminalPushController,
  ],
  providers: [
    TerminalCryptoService,
    TerminalsService,
    TerminalConfigAuditService,
    HikvisionEventsService,
    HikvisionService,
    HikvisionPhotoService,
    PersonSyncService,
    TerminalHealthScheduler,
    TerminalStatusHistoryService,
    TerminalDiagnosticsService,
    TerminalCompareJobService,
    TerminalPushCredentialsService,
  ],
  exports: [
    TerminalCryptoService,
    HikvisionEventsService,
    HikvisionPhotoService,
    PersonSyncService,
  ],
})
export class TerminalsModule { }
