import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';

import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';

import { TERMINAL_SYNC_QUEUE } from './terminal-sync.constants';
import type { TerminalSyncJob } from './terminal-sync.constants';

// Har daqiqada sinxronlash navbatini tekshiramiz.
const SYNC_CRON = '*/5 * * * * *';

// HealthCheck ketma-ket muvaffaqiyatsiz bo'lsa,
// event so'rovlarini vaqtincha kamaytiramiz.
const OFFLINE_FAILURE_THRESHOLD = 2;

// HealthCheck natijasiga asoslangan kutish oralig'i.
const OFFLINE_RETRY_BASE_MS = 60_000;
const OFFLINE_RETRY_MAX_MS = 5 * 60_000;

// HealthCheck juda eski bo'lsa,
// offline natijasiga ishonmaymiz.
const HEALTH_MAX_AGE_MS = 5 * 60_000;

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

  private shouldSkipOffline(terminal: Terminal, now: number): boolean {
    if (terminal.consecutiveFailures < OFFLINE_FAILURE_THRESHOLD) {
      return false;
    }

    if (!terminal.lastCheckedAt) {
      return false;
    }

    const lastCheckedMs = new Date(terminal.lastCheckedAt).getTime();

    if (!Number.isFinite(lastCheckedMs)) {
      return false;
    }

    const ageMs = now - lastCheckedMs;

    if (ageMs < 0 || ageMs > HEALTH_MAX_AGE_MS) {
      return false;
    }

    const exponent = Math.min(
      terminal.consecutiveFailures - OFFLINE_FAILURE_THRESHOLD,
      6,
    );

    const cooldownMs = Math.min(
      OFFLINE_RETRY_BASE_MS * 2 ** exponent,
      OFFLINE_RETRY_MAX_MS,
    );

    return ageMs < cooldownMs;
  }

  @Cron(SYNC_CRON, {
    timeZone: 'Asia/Tashkent',
  })
  async enqueue(): Promise<void> {
    if (this.enqueueing) {
      return;
    }

    this.enqueueing = true;

    try {
      const terminals = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .select([
          'terminal.id',
          'terminal.consecutiveFailures',
          'terminal.lastCheckedAt',
        ])
        .where('terminal.isActive = :active', {
          active: true,
        })
        .andWhere('terminal.archivedAt IS NULL')
        .andWhere('terminal.syncStartAt IS NOT NULL')
        .orderBy('terminal.id', 'ASC')
        .getMany();

      const now = Date.now();

      let queued = 0;
      let offlineSkipped = 0;

      for (const terminal of terminals) {
        if (this.shouldSkipOffline(terminal, now)) {
          offlineSkipped++;
          continue;
        }

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
              delay: 15_000,
            },

            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        queued++;
      }

      if (terminals.length > 0) {
        this.logger.log(
          `Terminal sync: ` +
            `jami=${terminals.length}, ` +
            `navbatga_tekshirildi=${queued}, ` +
            `offline_kutishda=${offlineSkipped}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Terminal navbatini tayyorlash xatosi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.enqueueing = false;
    }
  }
}
