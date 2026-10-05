import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';

import type { TerminalSyncJob } from './terminal-sync.constants';

import { TerminalSyncService } from './terminal-sync.service';

@Processor(TERMINAL_SYNC_QUEUE, {
  concurrency: 3,
})
export class TerminalSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TerminalSyncProcessor.name);

  constructor(private readonly terminalSyncService: TerminalSyncService) {
    super();
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
      `Terminal ${job?.data.terminalId ?? '?'}: ${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(): void {
    this.logger.error(
      'Terminal worker ulanishida xatolik. Redis holatini tekshiring',
    );
  }
}
