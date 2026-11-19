import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import {
  LIVE_CHANNEL_PREFIX,
  type LiveEvent,
} from '../hikvision-push/hikvision-push.types';

type Listener = (events: LiveEvent[]) => void;

/**
 * Har API jarayonida bitta Redis obuna ulanishi. Ko‘rsatilayotgan
 * maktablargagina SUBSCRIBE qilinadi — barcha maktablar trafigi
 * API'ga kelmaydi. Bir maktabni 100 kishi ko‘rsa ham, obuna bitta.
 */
@Injectable()
export class LiveHubService implements OnModuleDestroy {
  private readonly logger = new Logger(LiveHubService.name);
  private subscriber: Redis | null = null;
  private readonly listeners = new Map<number, Set<Listener>>();

  constructor(private readonly redisService: RedisService) {}

  private connection(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.redisService.getClient().duplicate({
        enableOfflineQueue: true,
        // SUBSCRIBE’dan keyin INFO yuborilmasin — aks holda obuna yo‘qoladi.
        enableReadyCheck: false,
        commandTimeout: undefined,
      });
      this.subscriber.on('error', () => undefined);
      this.subscriber.on('message', (channel: string, payload: string) => {
        const schoolId = Number(channel.slice(LIVE_CHANNEL_PREFIX.length));
        const set = this.listeners.get(schoolId);
        if (!set) return;
        let events: LiveEvent[];
        try {
          events = JSON.parse(payload) as LiveEvent[];
        } catch {
          return;
        }
        for (const listener of set) listener(events);
      });
    }
    return this.subscriber;
  }

  subscribe(schoolId: number, listener: Listener): () => void {
    let set = this.listeners.get(schoolId);
    if (!set) {
      set = new Set();
      this.listeners.set(schoolId, set);
      this.connection()
        .subscribe(`${LIVE_CHANNEL_PREFIX}${schoolId}`)
        .catch(() =>
          this.logger.warn(`Jonli kanalga obuna bo‘lmadi: ${schoolId}`),
        );
    }
    set.add(listener);

    return () => {
      const current = this.listeners.get(schoolId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(schoolId);
        this.subscriber
          ?.unsubscribe(`${LIVE_CHANNEL_PREFIX}${schoolId}`)
          .catch(() => undefined);
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }
}
