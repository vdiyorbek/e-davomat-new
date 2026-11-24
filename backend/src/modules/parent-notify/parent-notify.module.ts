import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { AttendanceCalendarModule } from '../attendance-calendar/attendance-calendar.module';
import { PersonsModule } from '../persons/persons.module';
import { DailyAttendanceModule } from '../daily-attendance/daily-attendance.module';
import { ParentAbsentJob } from './parent-absent.service';
import { ParentAdminController } from './parent-admin.controller';
import { ParentAdminService } from './parent-admin.service';
import { ParentApiController } from './parent-api.controller';
import { ParentApiService } from './parent-api.service';
import { ParentBotService } from './parent-bot.service';
import { ParentEventWatcher } from './parent-event-watcher.service';
import { ParentNotifyService } from './parent-notify.service';
import { ParentSenderService } from './parent-sender.service';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramApiService } from './telegram-api.service';
import { TelegramInitDataGuard } from './telegram-init-data.guard';
import { TelegramWebhookController } from './telegram-webhook.controller';

/** Ota-onalarga Telegram orqali xabar va Mini App. Global: ariza xizmati to‘g‘ridan-to‘g‘ri ishlata oladi. */
@Global()
@Module({
  imports: [
    RedisModule,
    DailyAttendanceModule,
    AttendanceCalendarModule,
    PersonsModule,
  ],
  controllers: [
    ParentApiController,
    ParentAdminController,
    TelegramWebhookController,
  ],
  providers: [
    TerminalCryptoService,
    TelegramConfigService,
    TelegramApiService,
    TelegramInitDataGuard,
    ParentNotifyService,
    ParentSenderService,
    ParentBotService,
    ParentEventWatcher,
    ParentAbsentJob,
    ParentApiService,
    ParentAdminService,
  ],
  exports: [ParentNotifyService],
})
export class ParentNotifyModule {}
