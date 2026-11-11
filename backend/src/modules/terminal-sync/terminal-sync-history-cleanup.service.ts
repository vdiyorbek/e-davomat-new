import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TerminalSyncRun } from './terminal-sync-run.entity';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500;
const MAX_BATCHES = 10;

@Injectable()
export class TerminalSyncHistoryCleanupService {
  private readonly logger = new Logger(TerminalSyncHistoryCleanupService.name);

  private running = false;

  constructor(
    @InjectRepository(TerminalSyncRun)
    private readonly repository: Repository<TerminalSyncRun>,
  ) {}

  // Har kuni Toshkent vaqti bilan 03:15.
  @Cron('0 15 3 * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async cleanup(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      const cutoff = new Date(
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );

      let totalDeleted = 0;

      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const result: unknown = await this.repository.manager.query(
          `
          DELETE FROM terminal_sync_runs
          WHERE finishedAt < ?
          ORDER BY finishedAt ASC
          LIMIT ?
          `,
          [cutoff, BATCH_SIZE],
        );

        const deleted =
          result &&
          typeof result === 'object' &&
          'affectedRows' in result &&
          typeof result.affectedRows === 'number'
            ? result.affectedRows
            : 0;

        totalDeleted += deleted;

        if (deleted < BATCH_SIZE) break;
      }

      this.logger.log(`Sync tarixi tozalandi. O‘chirilgan: ${totalDeleted}`);
    } catch {
      this.logger.error('Sinxronlash tarixini tozalashda xatolik yuz berdi');
    } finally {
      this.running = false;
    }
  }
}
