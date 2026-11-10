import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../../redis/redis.service';

const LOCK_TTL_MS = 120_000;
const RENEW_INTERVAL_MS = 30_000;

const RENEW_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
  end
  return 0
`;

const RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const CHECK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return 1
  end
  return 0
`;

export interface EventSyncLease {
  assertOwned(): Promise<void>;
  release(): Promise<void>;
}

@Injectable()
export class EventSyncTerminalLockService {
  private readonly logger = new Logger(EventSyncTerminalLockService.name);

  constructor(private readonly redisService: RedisService) {}

  async acquire(
    terminalId: number,
    scope: 'events' | 'run' | 'photos' = 'events',
  ): Promise<EventSyncLease> {
    const redis = this.redisService.getClient();

    const key =
      scope === 'run'
        ? `edavomat:terminal-sync:run:${terminalId}:lock`
        : scope === 'photos'
          ? `edavomat:photo-sync:terminal:${terminalId}:lock`
          : `edavomat:event-sync:terminal:${terminalId}:lock`;

    const token = randomUUID();

    const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');

    if (acquired !== 'OK') {
      throw new ConflictException(
        `Terminal ${terminalId}: sinxronlash allaqachon ishlamoqda`,
      );
    }

    let stopped = false;
    let lost = false;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let renewalPromise: Promise<void> | null = null;

    const scheduleRenewal = (): void => {
      if (stopped || lost) return;

      timer = setTimeout(() => {
        renewalPromise = (async () => {
          try {
            const renewed = await redis.eval(
              RENEW_SCRIPT,
              1,
              key,
              token,
              String(LOCK_TTL_MS),
            );

            if (Number(renewed) !== 1) {
              lost = true;

              this.logger.error(
                `Terminal ${terminalId}: Redis lock yo'qotildi`,
              );
            }
          } catch (error: unknown) {
            lost = true;

            this.logger.error(
              `Terminal ${terminalId}: lock renewal xatosi: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          } finally {
            if (!stopped && !lost) {
              scheduleRenewal();
            }
          }
        })();
      }, RENEW_INTERVAL_MS);

      timer.unref();
    };

    scheduleRenewal();

    return {
      assertOwned: async (): Promise<void> => {
        if (stopped || lost) {
          throw new Error('EVENT_SYNC_LOCK_LOST');
        }

        const owned = await redis.eval(CHECK_SCRIPT, 1, key, token);

        if (Number(owned) !== 1) {
          lost = true;
          throw new Error('EVENT_SYNC_LOCK_LOST');
        }
      },

      release: async (): Promise<void> => {
        if (stopped) return;

        stopped = true;

        if (timer !== null) {
          clearTimeout(timer);
        }

        if (renewalPromise !== null) {
          await renewalPromise;
        }

        try {
          await redis.eval(RELEASE_SCRIPT, 1, key, token);
        } catch (error: unknown) {
          this.logger.error(
            `Terminal ${terminalId}: lock release xatosi: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    };
  }
}
