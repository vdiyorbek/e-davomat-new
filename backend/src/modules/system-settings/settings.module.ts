import { Global, Module } from '@nestjs/common';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/** Global: har modul SettingsService'ni import qilmasdan ishlatadi. */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SystemSettingsModule {}
