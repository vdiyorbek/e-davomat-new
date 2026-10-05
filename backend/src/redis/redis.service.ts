import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const port = Number(config.getOrThrow<string>('REDIS_PORT'));

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('REDIS_PORT noto‘g‘ri kiritilgan');
    }

    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port,

      username: config.get<string>('REDIS_USERNAME') || undefined,
      password: config.get<string>('REDIS_PASSWORD') || undefined,

      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,

      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });

    this.client.on('error', () => {
      this.logger.error(
        'Redis ulanishida xatolik. Servis va .env sozlamalarini tekshiring.',
      );
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ulanishi tayyor');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();

      const result = await this.ping();

      if (result !== 'PONG') {
        throw new Error('Redis kutilmagan javob qaytardi');
      }

      this.logger.log('Redis tekshiruvi: PONG');
    } catch {
      this.client.disconnect();

      throw new Error(
        'Redisga ulanib bo‘lmadi. REDIS_HOST, REDIS_PORT va parolni tekshiring.',
      );
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        await this.client.quit();
      }
    } finally {
      this.client.disconnect();
    }
  }
}