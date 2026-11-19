import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostname } from 'node:os';
import type { Redis } from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import { PushEventWriterService } from './push-event-writer.service';
import {
  PUSH_STREAM_GROUP,
  PUSH_STREAM_KEY,
  type PushStreamEvent,
} from './hikvision-push.types';

type StreamEntry = [id: string, fields: string[]];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function decodeEntry(fields: string[]): PushStreamEvent | null {
  const index = fields.indexOf('d');
  if (index === -1) return null;
  try {
    const value = JSON.parse(fields[index + 1]) as PushStreamEvent;
    const valid =
      Number.isSafeInteger(value.t) &&
      value.t > 0 &&
      Number.isSafeInteger(value.s) &&
      value.s > 0 &&
      (value.d === 'IN' || value.d === 'OUT') &&
      /^\d{14}$/.test(value.p) &&
      /^\d{1,20}$/.test(value.n) &&
      Number.isFinite(new Date(value.at).getTime()) &&
      (value.ph === null ||
        /^uploads\/attendance\/[\w/.-]+\.jpg$/.test(value.ph));
    return valid ? value : null;
  } catch {
    return null;
  }
}

/**
 * Redis Stream consumer group: bir nechta worker jarayoni parallel
 * o‘qiydi, har biri paket (PUSH_BATCH_SIZE) bilan MySQL'ga yozadi.
 * Xabar faqat muvaffaqiyatli yozilgandan keyin ACK qilinadi; jarayon
 * yiqilsa, osilib qolgan xabarlarni boshqa consumer XAUTOCLAIM bilan oladi.
 */
@Injectable()
export class HikvisionPushConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(HikvisionPushConsumer.name);
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly connections: Redis[] = [];
  private loops: Promise<void>[] = [];
  private stopped = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly writer: PushEventWriterService,
    config: ConfigService,
  ) {
    this.batchSize = Math.min(
      2000,
      Math.max(10, Number(config.get('PUSH_BATCH_SIZE') ?? 500)),
    );
    this.concurrency = Math.min(
      16,
      Math.max(1, Number(config.get('PUSH_CONSUMER_CONCURRENCY') ?? 2)),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    const redis = this.redisService.getClient();
    try {
      // '0' — guruh yaratilishidan oldin yozilgan eventlar ham o‘qiladi.
      await redis.xgroup(
        'CREATE',
        PUSH_STREAM_KEY,
        PUSH_STREAM_GROUP,
        '0',
        'MKSTREAM',
      );
    } catch (error: unknown) {
      if (!errorText(error).includes('BUSYGROUP')) throw error;
    }

    for (let i = 0; i < this.concurrency; i++) {
      // Bloklovchi XREADGROUP umumiy ulanishni band qilmasligi uchun alohida ulanish.
      const connection = redis.duplicate({
        commandTimeout: 15_000,
        enableOfflineQueue: true,
      });
      this.connections.push(connection);
      this.loops.push(
        this.run(connection, `${hostname()}-${process.pid}-${i}`),
      );
    }

    this.logger.log(
      `Push consumer: ${this.concurrency} ta oqim, paket=${this.batchSize}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled(this.loops);
    await Promise.allSettled(
      this.connections.map((connection) => connection.quit()),
    );
  }

  private async run(redis: Redis, consumer: string): Promise<void> {
    let lastClaimAt = 0;

    while (!this.stopped) {
      try {
        let entries: StreamEntry[] = [];

        if (Date.now() - lastClaimAt > 30_000) {
          lastClaimAt = Date.now();
          const claimed = (await redis.xautoclaim(
            PUSH_STREAM_KEY,
            PUSH_STREAM_GROUP,
            consumer,
            60_000,
            '0-0',
            'COUNT',
            this.batchSize,
          )) as [string, StreamEntry[]];
          entries = claimed[1].filter((entry) => entry && entry[1]);
        }

        if (entries.length === 0) {
          const result = (await redis.xreadgroup(
            'GROUP',
            PUSH_STREAM_GROUP,
            consumer,
            'COUNT',
            this.batchSize,
            'BLOCK',
            2000,
            'STREAMS',
            PUSH_STREAM_KEY,
            '>',
          )) as [string, StreamEntry[]][] | null;
          entries = result?.[0]?.[1] ?? [];
        }

        if (entries.length > 0) await this.handle(redis, entries);
      } catch (error: unknown) {
        this.logger.error(`Push consumer xatosi: ${errorText(error)}`);
        await sleep(2000);
      }
    }
  }

  private async handle(redis: Redis, entries: StreamEntry[]): Promise<void> {
    const ids = entries.map(([id]) => id);
    const events: PushStreamEvent[] = [];

    for (const [id, fields] of entries) {
      const event = decodeEntry(fields);
      if (event) events.push(event);
      else this.logger.warn(`Noto‘g‘ri stream xabari tashlab yuborildi: ${id}`);
    }

    // MySQL ishlamasa — ACK qilinmaydi, xabarlar navbatda qoladi va
    // keyinroq qayta ishlanadi (at-least-once; unique index takrorni to‘sadi).
    await this.writeWithFallback(events);

    await redis
      .multi()
      .xack(PUSH_STREAM_KEY, PUSH_STREAM_GROUP, ...ids)
      .xdel(PUSH_STREAM_KEY, ...ids)
      .exec();
  }

  private async writeWithFallback(events: PushStreamEvent[]): Promise<void> {
    try {
      await this.writer.write(events);
      return;
    } catch (error: unknown) {
      if (events.length === 1 || this.isTransient(error)) throw error;
      this.logger.warn(
        `Paket yozilmadi (${errorText(error)}), bittalab yoziladi`,
      );
    }

    // Bitta buzuq xabar (masalan, o‘chirilgan terminal) butun paketni to‘xtatmasin.
    for (const event of events) {
      try {
        await this.writer.write([event]);
      } catch (error: unknown) {
        if (this.isTransient(error)) throw error;
        this.logger.error(
          `Event tashlab yuborildi: terminal=${event.t}, serial=${event.n}: ${errorText(error)}`,
        );
      }
    }
  }

  private isTransient(error: unknown): boolean {
    const code =
      (error as { code?: string; driverError?: { code?: string } })?.driverError
        ?.code ??
      (error as { code?: string })?.code ??
      '';
    return (
      /^(ECONN|ETIMEDOUT|EPIPE|PROTOCOL_|ER_LOCK_|ER_CON_COUNT|ER_TOO_MANY)/.test(
        code,
      ) || /Connection|timeout|ECONNREFUSED/i.test(errorText(error))
    );
  }
}
