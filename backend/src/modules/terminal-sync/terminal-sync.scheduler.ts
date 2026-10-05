import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';

import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';

import type { TerminalSyncJob } from './terminal-sync.constants';

@Injectable()
export class TerminalSyncScheduler {
  private readonly logger = new Logger(TerminalSyncScheduler.name);

  private enqueueing = false;

  constructor(
    @InjectQueue(TERMINAL_SYNC_QUEUE)
    private readonly queue: Queue<TerminalSyncJob>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
  ) {}

  @Cron('0 */5 * * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async enqueue(): Promise<void> {
    if (this.enqueueing) return;

    this.enqueueing = true;

    try {
      const terminals = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .select(['terminal.id'])
        .where('terminal.isActive = :active', {
          active: true,
        })
        .andWhere('terminal.syncStartAt IS NOT NULL')
        .orderBy('terminal.id', 'ASC')
        .getMany();

      for (const terminal of terminals) {
        await this.queue.add(
          'sync-terminal',
          {
            terminalId: terminal.id,
          },
          {
            jobId: `terminal-${terminal.id}`,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }

      if (terminals.length > 0) {
        this.logger.log(
          `${terminals.length} ta terminal uchun navbat tekshirildi`,
        );
      }
    } catch {
      this.logger.error(
        'Terminallarni navbatga qo‘yib bo‘lmadi. MySQL va Redisni tekshiring',
      );
    } finally {
      this.enqueueing = false;
    }
  }
}
