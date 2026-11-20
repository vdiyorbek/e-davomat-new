import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { typeOrmOptions } from './database/typeorm-options';
import { HikvisionPushModule } from './modules/hikvision-push/hikvision-push.module';
import { SystemSettingsModule } from './modules/system-settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...typeOrmOptions(
          config,
          Number(config.get('PUSH_WORKER_DB_POOL') ?? 10),
        ),
        // Worker faqat bir nechta modulni yuklaydi; entity'lar orasidagi
        // bog‘lanishlar to‘liq bo‘lishi uchun hammasini ro‘yxatga olamiz.
        entities: [join(__dirname, '**', '*.entity.{js,ts}')],
      }),
    }),
    SystemSettingsModule,
    HikvisionPushModule,
  ],
})
export class PushWorkerModule {}
