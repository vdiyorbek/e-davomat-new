import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';

import { TerminalSyncRun } from './terminal-sync-run.entity';

import {
  TERMINAL_SYNC_QUEUE,
  TerminalSyncJob,
} from './terminal-sync.constants';

@Controller('terminal-sync-monitoring')
@Roles(UserRole.SUPER_ADMIN)
export class TerminalSyncMonitoringController {
  constructor(
    @InjectQueue(TERMINAL_SYNC_QUEUE)
    private readonly queue: Queue<TerminalSyncJob>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(TerminalSyncRun)
    private readonly historyRepository: Repository<TerminalSyncRun>,
  ) {}

  @Get(':terminalId')
  async getStatus(
    @Param('terminalId', ParseIntPipe)
    terminalId: number,
  ) {
    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const [job, counts] = await Promise.all([
      this.queue.getJob(`terminal-${terminalId}`),
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    ]);

    const jobState = job ? await job.getState() : null;

    return {
      terminalId,
      queueName: TERMINAL_SYNC_QUEUE,
      state: jobState ?? 'idle',
      attemptsMade: job?.attemptsMade ?? 0,
      maxAttempts: job?.opts.attempts ?? 0,
      jobId: job?.id ?? null,
      lastFailedReason: job?.failedReason ?? null,
      queue: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      },
      sync: {
        syncStartAt: terminal.syncStartAt,
        eventsSyncedUntil: terminal.eventsSyncedUntil,
        lastSuccessfulSyncAt: terminal.lastSuccessfulSyncAt,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  @Get(':terminalId/history')
  async getHistory(
    @Param('terminalId', ParseIntPipe)
    terminalId: number,
  ) {
    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const [runs, total] = await this.historyRepository.findAndCount({
      where: { terminalId },
      order: {
        startedAt: 'DESC',
        id: 'DESC',
      },
      take: 20,
    });

    return {
      success: true,
      terminalId,
      total,
      items: runs.map((run) => ({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        cursorBefore: run.cursorBefore,
        cursorAfter: run.cursorAfter,
        errorCode: run.errorCode,
      })),
    };
  }
}
