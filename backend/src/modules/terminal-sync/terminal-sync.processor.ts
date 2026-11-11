import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import type { TerminalSyncJob } from './terminal-sync.constants';

import { TerminalSyncService } from './terminal-sync.service';
import type { TerminalSyncRunSummary } from './terminal-sync.service';
import { RedisService } from '../../redis/redis.service';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Terminal } from '../terminals/terminal.entity';
import {
  TerminalSyncRun,
  TerminalSyncRunStatus,
} from './terminal-sync-run.entity';

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 20;

@Injectable()
@Processor(TERMINAL_SYNC_QUEUE, {
  concurrency: DEFAULT_CONCURRENCY,
})
export class TerminalSyncProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(TerminalSyncProcessor.name);

  constructor(
    private readonly terminalSyncService: TerminalSyncService,
    private readonly configService: ConfigService,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(TerminalSyncRun)
    private readonly historyRepository: Repository<TerminalSyncRun>,

    private readonly redisService: RedisService,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    const configured = this.configService.get<string>(
      'TERMINAL_SYNC_CONCURRENCY',
    );

    const concurrency =
      configured === undefined || configured.trim() === ''
        ? DEFAULT_CONCURRENCY
        : Number(configured);

    if (
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > MAX_CONCURRENCY
    ) {
      throw new Error(
        `TERMINAL_SYNC_CONCURRENCY 1 dan ${MAX_CONCURRENCY} gacha bo'lishi kerak`,
      );
    }

    this.worker.concurrency = concurrency;

    this.logger.log(
      `Terminal Sync Worker ishga tushdi. ` +
        `Concurrency: ${this.worker.concurrency}`,
    );
  }

  async process(job: Job<TerminalSyncJob>): Promise<void> {
    if (job.name !== 'sync-terminal') {
      throw new Error('Noma’lum terminal vazifasi');
    }

    const terminalId = job.data.terminalId;

    if (
      !Number.isInteger(terminalId) ||
      terminalId < 1 ||
      terminalId > 4294967295
    ) {
      throw new Error('Terminal ID noto‘g‘ri');
    }

    const startedAt = new Date();

    const before = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    const cursorBefore = before?.eventsSyncedUntil ?? null;

    let cursorAfter: Date | null = null;
    let syncError: unknown = null;
    let summary: TerminalSyncRunSummary | null = null;

    try {
      summary = await this.terminalSyncService.run(terminalId);

      const after = await this.terminalsRepository.findOneBy({
        id: terminalId,
      });

      cursorAfter = after?.eventsSyncedUntil ?? null;
    } catch (error: unknown) {
      if (
        error instanceof ConflictException &&
        error.message ===
          `Terminal ${terminalId}: sinxronlash allaqachon ishlamoqda`
      ) {
        // Boshqa worker ushbu terminalni
        // sinxronlayapti. Bu haqiqiy sync xatosi emas.
        this.logger.debug(
          `Terminal ${terminalId}: parallel sync o'tkazib yuborildi`,
        );

        return;
      }

      syncError = error;
    }

    // Tarix yozish asosiy sinxronlash natijasini
    // o'zgartirmasligi kerak.
    const beforeMs = cursorBefore?.getTime() ?? 0;
    const afterMs = cursorAfter?.getTime() ?? 0;

    // Avval kursor siljigan har bir sikl (har ~5 s) yozilar edi —
    // 100 terminalda kuniga ~1.7 mln qator. Endi faqat:
    //  • xatolik,
    //  • yangi event saqlangan sikl,
    //  • yoki terminal «tirikligini» ko‘rsatish uchun 15 daqiqada bir yozuv.
    const shouldSave =
      syncError !== null ||
      (afterMs > beforeMs &&
        ((summary?.inserted ?? 0) > 0 ||
          (await this.heartbeatDue(terminalId))));

    if (shouldSave) {
      try {
        await this.saveSyncHistory({
          terminalId,
          status:
            syncError === null
              ? TerminalSyncRunStatus.SUCCESS
              : TerminalSyncRunStatus.FAILED,
          startedAt,
          cursorBefore,
          cursorAfter,
          errorCode: syncError === null ? null : this.errorCode(syncError),
          fetchedEvents: summary?.fetched ?? 0,
          insertedEvents: summary?.inserted ?? 0,
        });
      } catch {
        this.logger.error(
          `Terminal ${terminalId}: sync tarixini saqlab bo‘lmadi`,
        );
      }
    }

    // Faqat haqiqiy sinxronlash xatosi BullMQ'ga o'tadi.
    if (syncError !== null) {
      throw syncError;
    }
  }

  private async saveSyncHistory(input: {
    terminalId: number;
    status: TerminalSyncRunStatus;
    startedAt: Date;
    cursorBefore: Date | null;
    cursorAfter: Date | null;
    errorCode: string | null;
    fetchedEvents: number;
    insertedEvents: number;
  }): Promise<void> {
    const finishedAt = new Date();

    const durationMs = Math.max(
      0,
      finishedAt.getTime() - input.startedAt.getTime(),
    );

    await this.historyRepository.insert({
      terminalId: input.terminalId,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt,
      durationMs,
      cursorBefore: input.cursorBefore,
      cursorAfter: input.cursorAfter,
      errorCode: input.errorCode,
      fetchedEvents: input.fetchedEvents,
      insertedEvents: input.insertedEvents,
    });
  }

  /** 15 daqiqada bir marta «hech narsa yangi emas» yozuvini saqlash uchun. */
  private async heartbeatDue(terminalId: number): Promise<boolean> {
    try {
      const claimed = await this.redisService
        .getClient()
        .set(
          `edav:terminal-sync:history-heartbeat:${terminalId}`,
          '1',
          'EX',
          15 * 60,
          'NX',
        );

      return claimed === 'OK';
    } catch {
      return false;
    }
  }

  /** Tarixda ko‘rsatish uchun qisqa xato kodi (varchar 50). */
  private errorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (/ETIMEDOUT|timeout|timed out/i.test(message)) return 'DEVICE_TIMEOUT';
    if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/i.test(message))
      return 'DEVICE_UNREACHABLE';
    if (/401|unauthori[sz]ed|parol/i.test(message)) return 'DEVICE_AUTH_FAILED';
    if (/bazaga saqlash|QueryFailed/i.test(message)) return 'DATABASE_ERROR';
    if (/chegarasi o‘zgardi/i.test(message)) return 'CURSOR_CONFLICT';

    return 'SYNC_FAILED';
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<TerminalSyncJob> | undefined, error: Error): void {
    this.logger.warn(
      `Terminal ${job?.data.terminalId ?? '?'}: ` + `${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(): void {
    this.logger.error(
      'Terminal worker ulanishida xatolik. ' + 'Redis holatini tekshiring',
    );
  }
}
