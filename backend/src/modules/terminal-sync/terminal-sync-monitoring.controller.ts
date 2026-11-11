import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';

import { In, Repository } from 'typeorm';
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

  @Get('history')
  async getAllHistory(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('terminalId') terminalRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('dateFrom') fromRaw?: string,
    @Query('dateTo') toRaw?: string,
  ) {
    const parsePositive = (
      raw: string | undefined,
      fallback: number,
      max: number,
    ): number => {
      if (raw === undefined) return fallback;

      if (!/^[1-9]\d*$/.test(raw)) {
        throw new BadRequestException('Musbat butun son talab qilinadi');
      }

      const value = Number(raw);

      if (!Number.isSafeInteger(value) || value > max) {
        throw new BadRequestException('Qiymat noto‘g‘ri');
      }

      return value;
    };

    const page = parsePositive(pageRaw, 1, 1000000);
    const limit = parsePositive(limitRaw, 20, 100);

    const terminalId = terminalRaw
      ? parsePositive(terminalRaw, 1, 4294967295)
      : null;

    const status = statusRaw || 'ALL';

    if (!['ALL', 'SUCCESS', 'FAILED'].includes(status)) {
      throw new BadRequestException('Holat noto‘g‘ri');
    }

    const parseDate = (raw: string | undefined) => {
      if (!raw) return null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new BadRequestException('Sana formati noto‘g‘ri');
      }

      const parsed = new Date(`${raw}T00:00:00+05:00`);

      if (
        Number.isNaN(parsed.getTime()) ||
        new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw
      ) {
        throw new BadRequestException('Sana noto‘g‘ri');
      }

      return parsed;
    };

    const dateFrom = parseDate(fromRaw);
    const dateTo = parseDate(toRaw);

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('Boshlanish sanasi tugash sanasidan keyin');
    }

    const qb = this.historyRepository.createQueryBuilder('run');

    if (terminalId !== null) {
      qb.andWhere('run.terminalId = :terminalId', {
        terminalId,
      });
    }

    if (status !== 'ALL') {
      qb.andWhere('run.status = :status', { status });
    }

    if (dateFrom) {
      qb.andWhere('run.startedAt >= :dateFrom', {
        dateFrom,
      });
    }

    if (dateTo) {
      const exclusiveEnd = new Date(dateTo.getTime() + 24 * 60 * 60 * 1000);

      qb.andWhere('run.startedAt < :exclusiveEnd', {
        exclusiveEnd,
      });
    }

    const [runs, totalItems] = await qb
      .orderBy('run.startedAt', 'DESC')
      .addOrderBy('run.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const terminalIds = [...new Set(runs.map((run) => run.terminalId))];

    const terminals = terminalIds.length
      ? await this.terminalsRepository.findBy({
          id: In(terminalIds),
        })
      : [];

    const names = new Map(
      terminals.map((terminal) => [terminal.id, terminal.name]),
    );

    return {
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
      items: runs.map((run) => ({
        id: run.id,
        terminalId: run.terminalId,
        terminalName: names.get(run.terminalId) ?? null,
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
      lastFailedReason: null,
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
