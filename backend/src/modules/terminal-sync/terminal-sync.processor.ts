import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import type { TerminalSyncJob } from './terminal-sync.constants';

import { TerminalSyncService } from './terminal-sync.service';

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

    await this.terminalSyncService.run(job.data.terminalId);
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
