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
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PersonSyncScheduler } from './person-sync.scheduler';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';

import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';

interface PersonSyncCheckJob {
  terminalId: number;
  personId?: number;
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
  ) {}

  @Post('terminals/:id/check')
  @HttpCode(202)
  async enqueueCheck(@Param('id', ParseIntPipe) terminalId: number) {
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
        reason: 'TERMINAL_INACTIVE',
      };
    }

    // Bir terminal uchun 5 daqiqalik vaqt
    // oralig‘ida bir xil jobId ishlatiladi.
    const slot = Math.floor(Date.now() / (5 * 60 * 1000));
    const jobId = `manual-check-${terminalId}-${slot}`;

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

    return {
      terminalId,
      queued: true,
      jobId: job.id,
      jobName: job.name,
      message: 'Terminalni tekshirish vazifasi Redis navbatiga yuborildi',
    };
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    // Faqat ushbu controller yaratadigan
    // diagnostika vazifalarini ko‘rsatamiz.
    if (
      !/^manual-check-[1-9]\d*-\d+$/.test(jobId) &&
      !/^person-check-[1-9]\d*-\d{8}-\d{2}$/.test(jobId)
    ) {
      throw new NotFoundException('Vazifa topilmadi');
    }

    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Vazifa topilmadi yoki Redisdan tozalangan');
    }

    if (job.name !== PERSON_SYNC_JOB.CHECK_TERMINAL) {
      throw new NotFoundException('Vazifa topilmadi');
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      terminalId: job.data.terminalId,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
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
}
