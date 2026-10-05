import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
