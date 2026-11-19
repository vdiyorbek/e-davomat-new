/**
 * Push worker: Redis Stream'dagi terminal eventlarini MySQL'ga yozadi,
 * daily_attendance'ni yangilaydi va jonli efirga uzatadi.
 *
 *   node dist/push-worker.js
 *
 * Bir nechta nusxada ishga tushirish mumkin (consumer group).
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { PushWorkerModule } from './push-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(PushWorkerModule);
  app.enableShutdownHooks();
  Logger.log('Push worker ishga tushdi', 'Bootstrap');
}
void bootstrap();
