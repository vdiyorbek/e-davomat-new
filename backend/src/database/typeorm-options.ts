import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/** API va push worker uchun umumiy MySQL sozlamasi. */
export function typeOrmOptions(
  config: ConfigService,
  poolSize = 10,
): TypeOrmModuleOptions {
  const port = Number(config.getOrThrow<string>('DB_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT noto‘g‘ri kiritilgan');
  }

  return {
    type: 'mysql',

    host: config.getOrThrow<string>('DB_HOST'),
    port,
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_DATABASE'),

    autoLoadEntities: true,
    synchronize: false,

    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',

    retryAttempts: 3,
    retryDelay: 2000,
    connectTimeout: 10000,
    poolSize,

    logging: false,
  };
}
