import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Server faqat 127.0.0.1 da tinglaydi, ya'ni oldida reverse proxy turadi.
  // Proxy yuborgan X-Forwarded-For orqali mijozning haqiqiy IP manzilini
  // olamiz, aks holda login limiti barcha foydalanuvchilar uchun umumiy bo'ladi.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? '3000');

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port 1-65535 oralig'idagi butun son bo`lishi kerak");
  }
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(port, '127.0.0.1');

  Logger.log(`Backend ishga tushdi: http://localhost:${port}/api`, 'Bootstrap');
}
void bootstrap();
