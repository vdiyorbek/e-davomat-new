import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import type { TerminalSyncJob } from './terminal-sync.constants';

import { TerminalSyncService } from './terminal-sync.service';

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

    try {
      await this.terminalSyncService.run(terminalId);

      const after = await this.terminalsRepository.findOneBy({
        id: terminalId,
      });

      const cursorAfter = after?.eventsSyncedUntil ?? null;

      // Faqat cursor haqiqatda oldinga siljisa,
      // muvaffaqiyatli sinxronlashni qayd etamiz.
      const beforeMs = cursorBefore?.getTime() ?? 0;
      const afterMs = cursorAfter?.getTime() ?? 0;

      if (afterMs > beforeMs) {
        await this.saveSyncHistory({
          terminalId,
          status: TerminalSyncRunStatus.SUCCESS,
          startedAt,
          cursorBefore,
          cursorAfter,
          errorCode: null,
        });
      }
    } catch (error: unknown) {
      // Original xatolikni yo'qotmaymiz.
      // Tarix yozishdagi xato asosiy xatoni almashtirmasin.
      try {
        await this.saveSyncHistory({
          terminalId,
          status: TerminalSyncRunStatus.FAILED,
          startedAt,
          cursorBefore,
          cursorAfter: null,
          errorCode: 'SYNC_FAILED',
        });
      } catch {
        this.logger.error(
          `Terminal ${terminalId}: sync tarixini saqlab bo‘lmadi`,
        );
      }

      throw error;
    }
  }

  private async saveSyncHistory(input: {
    terminalId: number;
    status: TerminalSyncRunStatus;
    startedAt: Date;
    cursorBefore: Date | null;
    cursorAfter: Date | null;
    errorCode: string | null;
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
    });
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
