import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  BadRequestException,
  Body,
  Query,
  DefaultValuePipe,
  Req,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus,
} from './person-sync-batch-item.entity';
import { PersonSyncScheduler } from './person-sync.scheduler';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';
import {
  MonitoringStatus,
  PersonSyncMonitoringService,
} from './person-sync-monitoring.service';
import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';

interface PersonSyncCheckJob {
  terminalId: number;
  personId?: number;
  requestedByUserId?: number;
}

@Controller('person-sync-queue')
@Roles(UserRole.SUPER_ADMIN)
export class PersonSyncQueueController {
  constructor(
    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue<PersonSyncCheckJob>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly personSyncScheduler: PersonSyncScheduler,
    private readonly monitoringService: PersonSyncMonitoringService,

    @InjectRepository(PersonSyncBatchItem)
    private readonly batchItems: Repository<PersonSyncBatchItem>,
  ) {}

  @Post('terminals/:id/check')
  @HttpCode(202)
  async enqueueCheck(@Param('id', ParseIntPipe) terminalId: number) {
    if (!Number.isSafeInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('terminalId noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      return {
        terminalId,
        queued: false,
        reused: false,
        reason: 'TERMINAL_INACTIVE',
      };
    }

    const slot = Math.floor(Date.now() / (5 * 60 * 1000));

    const jobId = `manual-check-${terminalId}-${slot}`;

    // Shu 5 daqiqalik oraliqda job bormi?
    const existingJob = await this.queue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();

      return {
        terminalId,
        queued: state !== 'completed' && state !== 'failed',
        reused: true,
        jobId: existingJob.id,
        state,
        reason:
          state === 'completed'
            ? 'RECENT_JOB_COMPLETED'
            : state === 'failed'
              ? 'RECENT_JOB_FAILED'
              : 'JOB_ALREADY_EXISTS',
      };
    }

    const job = await this.queue.add(
      PERSON_SYNC_JOB.CHECK_TERMINAL,
      { terminalId },
      {
        jobId,
        attempts: 1,
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
          count: 1000,
        },
      },
    );

    const savedJob = await this.queue.getJob(String(job.id));

    if (!savedJob) {
      throw new Error('Redis navbatidagi vazifa topilmadi');
    }

    const state = await savedJob.getState();

    return {
      terminalId,
      queued: true,
      reused: false,
      jobId: savedJob.id,
      state,
      message: 'Diagnostika vazifasi qabul qilindi',
    };
  }

  @Post('terminals/:id/persons/:personId/sync')
  @HttpCode(202)
  async enqueuePersonSync(
    @Param('id', ParseIntPipe) terminalId: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    if (
      !Number.isSafeInteger(terminalId) ||
      terminalId <= 0 ||
      !Number.isSafeInteger(personId) ||
      personId <= 0
    ) {
      throw new BadRequestException('terminalId yoki personId noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      return {
        terminalId,
        personId,
        queued: false,
        reason: 'TERMINAL_INACTIVE',
      };
    }

    const jobId = `sync-person-${terminalId}-${personId}`;
    const existing = await this.queue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();

      if (state !== 'completed' && state !== 'failed') {
        return {
          terminalId,
          personId,
          queued: true,
          reused: true,
          jobId,
          state,
        };
      }

      // Tugagan vazifa bir xil jobId bilan yangisini bloklaydi.
      await existing.remove();
    }

    await this.queue.add(
      PERSON_SYNC_JOB.SYNC_PERSON,
      { terminalId, personId, requestedByUserId: actor.id },
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );

    return {
      terminalId,
      personId,
      queued: true,
      reused: false,
      jobId,
      message: 'Sinxronlash vazifasi qabul qilindi',
    };
  }

  /** Terminal xotirasidagi barcha shaxslarni o‘chirish (qaytarib bo‘lmaydi). */
  @Post('terminals/:id/clear')
  @HttpCode(202)
  async enqueueClear(
    @Param('id', ParseIntPipe) terminalId: number,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    const input =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (input.confirm !== 'CLEAR_TERMINAL_PERSONS') {
      throw new BadRequestException(
        'confirm: CLEAR_TERMINAL_PERSONS talab etiladi',
      );
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive || terminal.archivedAt) {
      throw new BadRequestException('Terminal faol emas');
    }

    // Yuklash ketayotganda tozalasak, navbatdagilar
    // yarim-yarti yuklanib qoladi.
    const inProgress = await this.batchItems.count({
      where: {
        terminalId,
        status: In([
          PersonSyncBatchItemStatus.PENDING,
          PersonSyncBatchItemStatus.QUEUED,
          PersonSyncBatchItemStatus.RUNNING,
        ]),
      },
    });

    if (inProgress > 0) {
      throw new ConflictException({
        code: 'SYNC_IN_PROGRESS',
        count: inProgress,
        message: `Bu terminalga ${inProgress} ta shaxs yuklanmoqda. Avval yuklash tugashini kuting.`,
      });
    }

    const jobId = `clear-terminal-${terminalId}-${Date.now()}`;

    await this.queue.add(
      PERSON_SYNC_JOB.CLEAR_TERMINAL,
      { terminalId, requestedByUserId: actor.id },
      {
        jobId,
        attempts: 1,
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );

    return { terminalId, queued: true, jobId };
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    // Faqat ushbu controller yaratadigan
    // diagnostika vazifalarini ko‘rsatamiz.
    if (
      !/^manual-check-[1-9]\d*-\d+$/.test(jobId) &&
      !/^person-check-[1-9]\d*-\d{8}-\d{2}$/.test(jobId) &&
      !/^sync-person-[1-9]\d*-[1-9]\d*$/.test(jobId) &&
      !/^clear-terminal-[1-9]\d*-\d+$/.test(jobId)
    ) {
      throw new NotFoundException('Vazifa topilmadi');
    }

    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Vazifa topilmadi yoki Redisdan tozalangan');
    }

    if (
      job.name !== PERSON_SYNC_JOB.CHECK_TERMINAL &&
      job.name !== PERSON_SYNC_JOB.SYNC_PERSON &&
      job.name !== PERSON_SYNC_JOB.CLEAR_TERMINAL
    ) {
      throw new NotFoundException('Vazifa topilmadi');
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      terminalId: job.data.terminalId,
      personId: job.data.personId ?? null,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }

  @Get('scheduler/preview')
  previewScheduler() {
    return this.personSyncScheduler.previewChecks();
  }

  @Post('scheduler/run')
  @HttpCode(202)
  runScheduler(@Body() body: unknown) {
    const input =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (input.confirm !== 'QUEUE_ALL_TERMINALS') {
      throw new BadRequestException(
        'confirm: QUEUE_ALL_TERMINALS talab etiladi',
      );
    }

    // force=true faqat qo‘lda ruxsat berilgan
    // diagnostikani ishga tushiradi.
    // Avtomatik yuklashga ruxsat bermaydi.
    return this.personSyncScheduler.enqueueChecks(true);
  }

  @Get('monitoring')
  getMonitoring(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('schoolId') schoolIdRaw?: string,
    @Query('search') searchRaw?: string,
  ) {
    const parsePositiveInteger = (
      value: string | undefined,
      fallback: number,
      field: string,
      max: number,
    ): number => {
      if (value === undefined) {
        return fallback;
      }

      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        throw new BadRequestException(
          `${field} musbat butun son bo‘lishi kerak`,
        );
      }

      const parsed = Number(value);

      if (!Number.isSafeInteger(parsed) || parsed > max) {
        throw new BadRequestException(
          `${field} 1 dan ${max} gacha bo‘lishi kerak`,
        );
      }

      return parsed;
    };

    const page = parsePositiveInteger(pageRaw, 1, 'page', 1000000);

    const limit = parsePositiveInteger(limitRaw, 20, 'limit', 100);

    const allowedStatuses: MonitoringStatus[] = [
      'ALL',
      'SUCCESS',
      'TIMEOUT',
      'ERROR',
      'NOT_CHECKED',
    ];

    const status = statusRaw ?? 'ALL';

    if (
      typeof status !== 'string' ||
      !allowedStatuses.includes(status as MonitoringStatus)
    ) {
      throw new BadRequestException('status qiymati noto‘g‘ri');
    }

    const schoolId =
      schoolIdRaw === undefined
        ? undefined
        : parsePositiveInteger(schoolIdRaw, 1, 'schoolId', 4294967295);
    if (
      searchRaw !== undefined &&
      (typeof searchRaw !== 'string' || searchRaw.trim().length > 100)
    ) {
      throw new BadRequestException('search 100 ta belgidan oshmasligi kerak');
    }

    const search = searchRaw?.trim() || undefined;
    return this.monitoringService.getMonitoring({
      page,
      limit,
      status: status as MonitoringStatus,
      schoolId,
      search,
    });
  }

  @Get('monitoring/terminals/:terminalId/history')
  getTerminalHistory(
    @Param('terminalId', ParseIntPipe)
    terminalId: number,

    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    if (terminalId <= 0 || !Number.isSafeInteger(terminalId)) {
      throw new BadRequestException('terminalId noto‘g‘ri');
    }

    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
      throw new BadRequestException('page noto‘g‘ri');
    }

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit 1 dan 50 gacha bo‘lishi kerak');
    }

    return this.monitoringService.getTerminalHistory(terminalId, page, limit);
  }
}
