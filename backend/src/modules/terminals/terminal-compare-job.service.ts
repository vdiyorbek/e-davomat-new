import { Injectable, Logger } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { RedisService } from '../../redis/redis.service';
import { TerminalsService } from './terminals.service';

type CompareResult = Awaited<
  ReturnType<TerminalsService['compareTerminalPersons']>
>;

export interface CompareState {
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  updatedAt: string;
  loaded: number;
  total: number | null;
  error: string | null;
}

const PREFIX = 'edavomat:terminal-compare';
const LOCK_SECONDS = 10 * 60;
const STATE_TTL = 24 * 3600;
const RESULT_TTL = 7 * 24 * 3600;

/**
 * Terminal bilan solishtirishni fonda bajaradi: jarayon (nechta o‘qildi) va oxirgi
 * natija Redis'da saqlanadi (migratsiya yo‘q). Bir terminal uchun bir vaqtda bitta vazifa.
 */
@Injectable()
export class TerminalCompareJobService {
  private readonly logger = new Logger(TerminalCompareJobService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly terminals: TerminalsService,
  ) {}

  private key(kind: 'state' | 'result' | 'lock', id: number) {
    return `${PREFIX}:${kind}:${id}`;
  }

  /** Vazifani boshlaydi; allaqachon ketayotgan bo‘lsa — unga ulanadi (qayta boshlamaydi). */
  async start(id: number, user: AuthenticatedUser) {
    // Ruxsat va terminal mavjudligini darhol tekshiramiz (xato 4xx bo‘lib qaytsin).
    await this.terminals.assertTerminalVisible(id, user);

    const client = this.redis.getClient();
    const locked = await client.set(
      this.key('lock', id),
      '1',
      'EX',
      LOCK_SECONDS,
      'NX',
    );

    if (locked === 'OK') {
      const now = new Date().toISOString();
      await this.save(id, {
        status: 'running',
        startedAt: now,
        updatedAt: now,
        loaded: 0,
        total: null,
        error: null,
      });
      void this.run(id, user);
    }

    return this.status(id, user);
  }

  async status(id: number, user: AuthenticatedUser) {
    await this.terminals.assertTerminalVisible(id, user);
    const client = this.redis.getClient();

    let state = await this.read<CompareState>('state', id);
    // Jarayon to‘xtab qolgan (qayta ishga tushish): qulf yo‘q, lekin holat «running».
    if (
      state?.status === 'running' &&
      (await client.exists(this.key('lock', id))) === 0
    ) {
      state = {
        ...state,
        status: 'failed',
        error:
          'Jarayon to‘xtatildi (server qayta ishga tushgan bo‘lishi mumkin)',
        updatedAt: new Date().toISOString(),
      };
      await this.save(id, state);
    }

    return {
      state,
      result: await this.read<CompareResult>('result', id),
    };
  }

  private async run(id: number, user: AuthenticatedUser): Promise<void> {
    const client = this.redis.getClient();
    const startedAt = new Date().toISOString();
    let lastWrite = 0;

    try {
      const result = await this.terminals.compareTerminalPersons(
        id,
        user,
        (loaded, total) => {
          const now = Date.now();
          // Redis'ga har sahifada emas, ~1 soniyada bir marta yoziladi.
          if (now - lastWrite < 800 && loaded < total) return;
          lastWrite = now;
          void this.save(id, {
            status: 'running',
            startedAt,
            updatedAt: new Date(now).toISOString(),
            loaded,
            total,
            error: null,
          });
          void client.expire(this.key('lock', id), LOCK_SECONDS);
        },
      );

      await client.set(
        this.key('result', id),
        JSON.stringify(result),
        'EX',
        RESULT_TTL,
      );
      await this.save(id, {
        status: 'done',
        startedAt,
        updatedAt: new Date().toISOString(),
        loaded: result.terminalPersons,
        total: result.terminalPersons,
        error: null,
      });
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : 'Solishtirib bo‘lmadi'
      ).slice(0, 200);
      this.logger.warn(`Solishtirish #${id}: ${message}`);
      await this.save(id, {
        status: 'failed',
        startedAt,
        updatedAt: new Date().toISOString(),
        loaded: 0,
        total: null,
        error: message,
      }).catch(() => undefined);
    } finally {
      await client.del(this.key('lock', id)).catch(() => undefined);
    }
  }

  private async save(id: number, state: CompareState): Promise<void> {
    await this.redis
      .getClient()
      .set(this.key('state', id), JSON.stringify(state), 'EX', STATE_TTL);
  }

  private async read<T>(
    kind: 'state' | 'result',
    id: number,
  ): Promise<T | null> {
    const raw = await this.redis.getClient().get(this.key(kind, id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
