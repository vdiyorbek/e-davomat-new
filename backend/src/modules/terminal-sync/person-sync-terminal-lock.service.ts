import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { PERSON_SYNC_QUEUE } from '../terminals/person-sync.constants';

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

export interface TerminalLockResult<T> {
  acquired: boolean;
  result?: T;
}

@Injectable()
export class PersonSyncTerminalLockService {
  private readonly logger = new Logger(PersonSyncTerminalLockService.name);

  constructor(
    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue,
  ) {}

  async run<T>(
    terminalId: number,
    operation: (assertOwned: () => Promise<void>) => Promise<T>,
  ): Promise<TerminalLockResult<T>> {
    const redis = (await this.queue.client) as unknown as Redis;

    const key = `edavomat:person-sync:terminal:${terminalId}:lock`;

    const token = randomUUID();

    const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');

    if (acquired !== 'OK') {
      this.logger.warn(`Terminal ${terminalId}: diagnostika lock band`);

      return { acquired: false };
    }

    let stopped = false;
    let lost = false;

    let timer: ReturnType<typeof setTimeout> | null = null;

    let renewalPromise: Promise<void> | null = null;

    const markLost = (reason: string) => {
      lost = true;
      this.logger.error(`Terminal ${terminalId}: lock yo‘qotildi: ${reason}`);
    };

    const assertOwned = async (): Promise<void> => {
      if (lost) {
        throw new Error('PERSON_SYNC_LOCK_LOST');
      }

      const owned = await redis.eval(CHECK_SCRIPT, 1, key, token);

      if (Number(owned) !== 1 || lost) {
        markLost('token mos kelmaydi yoki TTL tugagan');
        throw new Error('PERSON_SYNC_LOCK_LOST');
      }
    };

    const scheduleRenewal = () => {
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
              markLost('TTL yangilanmadi');
              return;
            }

            if (!stopped) {
              scheduleRenewal();
            }
          } catch (error: unknown) {
            markLost(error instanceof Error ? error.message : String(error));
          }
        })();
      }, RENEW_INTERVAL_MS);
    };

    scheduleRenewal();

    try {
      const result = await operation(assertOwned);

      await assertOwned();

      return {
        acquired: true,
        result,
      };
    } finally {
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
    }
  }
}
