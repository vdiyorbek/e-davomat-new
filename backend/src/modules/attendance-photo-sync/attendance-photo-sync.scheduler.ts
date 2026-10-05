import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import { Terminal } from '../terminals/terminal.entity';

import {
  ATTENDANCE_PHOTO_JOB,
  ATTENDANCE_PHOTO_QUEUE,
} from './attendance-photo-sync.constants';

import type { AttendancePhotoJob } from './attendance-photo-sync.constants';

@Injectable()
export class AttendancePhotoSyncScheduler {
  private readonly logger = new Logger(AttendancePhotoSyncScheduler.name);

  private enqueueing = false;

  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventsRepository: Repository<AttendanceEvent>,

    @InjectQueue(ATTENDANCE_PHOTO_QUEUE)
    private readonly photoQueue: Queue<AttendancePhotoJob>,
  ) {}

  // Har daqiqaning 15-soniyasida.
  @Cron('15 * * * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async enqueue(): Promise<void> {
    if (this.enqueueing) {
      return;
    }

    this.enqueueing = true;

    try {
      const retryBefore = new Date(Date.now() - 60_000);

      const terminals = await this.eventsRepository
        .createQueryBuilder('event')
        .innerJoin(Terminal, 'terminal', 'terminal.id = event.terminalId')
        .select('event.terminalId', 'terminalId')
        .distinct(true)
        .where('terminal.isActive = :isActive', {
          isActive: true,
        })
        .andWhere('event.photoStatus IN (:...statuses)', {
          statuses: [EventPhotoStatus.PENDING, EventPhotoStatus.FAILED],
        })
        .andWhere('event.photoAttempts < :maxAttempts', {
          maxAttempts: 5,
        })
        .andWhere(
          `(
            event.photoLastAttemptAt IS NULL
            OR event.photoLastAttemptAt <= :retryBefore
          )`,
          { retryBefore },
        )
        .orderBy('event.terminalId', 'ASC')
        .getRawMany<{ terminalId: number | string }>();

      for (const terminal of terminals) {
        const terminalId = Number(terminal.terminalId);

        await this.photoQueue.add(
          ATTENDANCE_PHOTO_JOB,
          { terminalId },
          {
            jobId: `photos-terminal-${terminalId}`,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 10_000,
            },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }

      if (terminals.length > 0) {
        this.logger.log(
          `${terminals.length} ta terminal uchun rasm navbati tekshirildi`,
        );
      }
    } catch {
      this.logger.error(
        'Rasm navbatini tayyorlab bo‘lmadi. MySQL va Redis ulanishini tekshiring.',
      );
    } finally {
      this.enqueueing = false;
    }
  }
}
