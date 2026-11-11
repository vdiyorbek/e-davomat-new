import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, LessThan, Repository } from 'typeorm';

import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';

import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus as Status,
} from './person-sync-batch-item.entity';

import { PersonSyncHistoryService } from './person-sync-history.service';

const MAX_ITEMS = 100;
const MIN_AGE_MS = 30 * 60 * 1000;

@Injectable()
export class PersonSyncReconciliationService {
  private readonly logger = new Logger(PersonSyncReconciliationService.name);

  private running = false;

  constructor(
    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue,

    @InjectRepository(PersonSyncBatchItem)
    private readonly items: Repository<PersonSyncBatchItem>,

    private readonly history: PersonSyncHistoryService,
  ) {}

  @Cron('0 */5 * * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async reconcile(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      const cutoff = new Date(Date.now() - MIN_AGE_MS);

      const items = await this.items.find({
        where: {
          status: In([Status.QUEUED, Status.RUNNING]),
          updatedAt: LessThan(cutoff),
        },
        order: {
          updatedAt: 'ASC',
          id: 'ASC',
        },
        take: MAX_ITEMS,
      });

      let repaired = 0;
      let unchanged = 0;

      for (const item of items) {
        try {
          const changed = await this.reconcileItem(item);

          if (changed) {
            repaired++;
          } else {
            unchanged++;
          }
        } catch (error: unknown) {
          this.logger.warn(
            `Reconciliation error: item=${item.id}, ` +
              `message=${
                error instanceof Error ? error.message : String(error)
              }`,
          );
        }
      }

      if (items.length > 0) {
        this.logger.log(
          `PersonSync reconciliation: ` +
            `checked=${items.length}, ` +
            `updated=${repaired}, ` +
            `unchanged=${unchanged}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Reconciliation bajarilmadi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async reconcileItem(item: PersonSyncBatchItem): Promise<boolean> {
    const jobId = item.jobId || `psh-${item.id}`;

    // Redis bilan aloqa uzilgan bo'lsa, getJob xato
    // qaytaradi. Bunday vaziyatda tarixni o'zgartirmaymiz.
    const job = await this.queue.getJob(jobId);

    if (!job) {
      await this.history.markFinished(
        item.id,
        Status.UNCERTAIN,
        'REDIS_JOB_NOT_FOUND',
      );

      return true;
    }

    if (
      job.name !== PERSON_SYNC_JOB.SYNC_PERSON ||
      job.data?.historyItemId !== item.id ||
      job.data?.terminalId !== item.terminalId ||
      job.data?.personId !== item.personId
    ) {
      await this.history.markFinished(
        item.id,
        Status.UNCERTAIN,
        'JOB_IDENTITY_MISMATCH',
      );

      return true;
    }

    const state = await job.getState();

    // Navbatda yoki bajarilayotgan jobni
    // qayta yubormaymiz va yakunlangan demaymiz.

    if (
      state === 'waiting' ||
      state === 'active' ||
      state === 'delayed' ||
      state === 'waiting-children' ||
      state === 'prioritized'
    ) {
      return false;
    }

    if (state === 'completed') {
      const value: unknown = job.returnvalue;

      if (value === null || typeof value !== 'object') {
        await this.history.markFinished(
          item.id,
          Status.UNCERTAIN,
          'INVALID_JOB_RESULT',
        );

        return true;
      }

      const result = value as Record<string, unknown>;

      if (
        result.terminalId !== item.terminalId ||
        result.personId !== item.personId
      ) {
        await this.history.markFinished(
          item.id,
          Status.UNCERTAIN,
          'RESULT_IDENTITY_MISMATCH',
        );

        return true;
      }

      if (result.status === 'VERIFIED') {
        await this.history.markFinished(item.id, Status.SUCCESS);

        return true;
      }

      if (result.action === 'BLOCKED' || result.action === 'MANUAL_REVIEW') {
        await this.history.markFinished(
          item.id,
          Status.SKIPPED,
          'SYNC_NOT_STARTED',
        );

        return true;
      }

      await this.history.markFinished(
        item.id,
        Status.UNCERTAIN,
        'JOB_NOT_VERIFIED',
      );

      return true;
    }

    if (state === 'failed') {
      // Failed job qurilmaga qisman yozgan bo'lishi
      // mumkin. Tasdiqsiz FAILED deb belgilamaymiz.
      await this.history.markFinished(
        item.id,
        Status.UNCERTAIN,
        'REDIS_JOB_FAILED',
      );

      return true;
    }

    // Noma'lum state yoki Redis ma'lumotlari
    // noaniq bo'lsa, jobga tegmaymiz.
    return false;
  }
}
