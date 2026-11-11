import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, In, Repository } from 'typeorm';

import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';
import {
  PersonSyncBatch,
  PersonSyncBatchStatus,
} from './person-sync-batch.entity';
import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus as Status,
} from './person-sync-batch-item.entity';
import { PersonSyncHistoryService } from './person-sync-history.service';

const LOCK_NAME = 'edav:person-sync:dispatcher';

/**
 * Bir siklda yuboriladigan vazifalar chegarasi.
 * Har terminalga baribir bir vaqtda faqat bitta vazifa
 * yuboriladi, shuning uchun bu — bir vaqtda ishlayotgan
 * terminallar sonining yuqori chegarasi.
 */
const MAX_PER_CYCLE = 50;

@Injectable()
export class PersonSyncDispatcherService {
  private readonly logger = new Logger(PersonSyncDispatcherService.name);

  private running = false;

  /** Dispatch ishlayotgan paytda yana chaqirilgan bo‘lsa — tugagach qayta ishlaydi. */
  private rerun = false;

  constructor(
    private readonly dataSource: DataSource,

    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue,

    @InjectRepository(PersonSyncBatchItem)
    private readonly items: Repository<PersonSyncBatchItem>,

    private readonly history: PersonSyncHistoryService,
  ) {}

  /**
   * Vazifa tugashi bilan shu terminalning keyingi shaxsini
   * darhol navbatga qo‘yish uchun processor chaqiradi.
   * Cron (har 5 s) zaxira sifatida qoladi.
   */
  kick(): void {
    setTimeout(() => {
      void this.dispatch();
    }, 250);
  }

  @Cron('*/5 * * * * *', {
    name: 'person-sync-dispatcher',
    timeZone: 'Asia/Tashkent',
  })
  async dispatch(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }

    this.running = true;

    const runner = this.dataSource.createQueryRunner();
    let connected = false;
    let locked = false;

    try {
      await runner.connect();
      connected = true;

      const lockRows: Array<{ acquired: number }> = await runner.query(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [LOCK_NAME],
      );

      if (Number(lockRows[0]?.acquired) !== 1) {
        return;
      }

      locked = true;

      // Har bir terminal uchun eng eski PENDING yozuvni olamiz.
      // Avval `ORDER BY id LIMIT 100` ishlatilgan edi: ALL rejimida
      // birinchi terminalning minglab yozuvlari oldinda turgani uchun
      // qolgan terminallar u tugaguncha navbat olmas edi.
      const heads = await this.items
        .createQueryBuilder('item')
        .innerJoin(PersonSyncBatch, 'batch', 'batch.id = item.batchId')
        .select('MIN(item.id)', 'itemId')
        .where('item.status = :status', {
          status: Status.PENDING,
        })
        .andWhere('batch.status IN (:...statuses)', {
          statuses: [
            PersonSyncBatchStatus.QUEUED,
            PersonSyncBatchStatus.RUNNING,
          ],
        })
        .groupBy('item.terminalId')
        .getRawMany<{ itemId: string | number }>();

      const candidates = heads.length
        ? await this.items.find({
            where: { id: In(heads.map((row) => String(row.itemId))) },
            order: { id: 'ASC' },
          })
        : [];

      let dispatched = 0;
      const usedTerminals = new Set<number>();
      const changedBatches = new Set<string>();

      for (const item of candidates) {
        if (dispatched >= MAX_PER_CYCLE) break;

        if (usedTerminals.has(item.terminalId)) {
          continue;
        }

        const inFlight = await this.items.count({
          where: {
            terminalId: item.terminalId,
            status: In([Status.QUEUED, Status.RUNNING]),
          },
        });

        if (inFlight > 0) {
          usedTerminals.add(item.terminalId);
          continue;
        }

        const batch = await this.items.manager.findOneBy(PersonSyncBatch, {
          id: item.batchId,
        });

        if (
          !batch ||
          !batch.requestedByUserId ||
          ![
            PersonSyncBatchStatus.QUEUED,
            PersonSyncBatchStatus.RUNNING,
          ].includes(batch.status)
        ) {
          continue;
        }

        const jobId = `psh-${item.id}`;

        try {
          const existing = await this.queue.getJob(jobId);

          if (
            existing &&
            (existing.name !== PERSON_SYNC_JOB.SYNC_PERSON ||
              existing.data?.historyItemId !== item.id ||
              existing.data?.terminalId !== item.terminalId ||
              existing.data?.personId !== item.personId)
          ) {
            await this.history.markFinished(
              item.id,
              Status.UNCERTAIN,
              'JOB_IDENTITY_MISMATCH',
            );

            changedBatches.add(item.batchId);
            usedTerminals.add(item.terminalId);
            continue;
          }

          if (!existing) {
            await this.queue.add(
              PERSON_SYNC_JOB.SYNC_PERSON,
              {
                terminalId: item.terminalId,
                personId: item.personId,
                requestedByUserId: batch.requestedByUserId,
                historyItemId: item.id,
              },
              {
                jobId,
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 15000,
                },
                removeOnComplete: {
                  age: 86400,
                  count: 10000,
                },
                removeOnFail: {
                  age: 86400,
                  count: 10000,
                },
              },
            );
          }

          await this.history.markQueued(item.id, jobId);

          dispatched++;
          usedTerminals.add(item.terminalId);
          changedBatches.add(item.batchId);
        } catch (error: unknown) {
          this.logger.warn(
            `Item ${item.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          // Redis javobi noaniq bo‘lsa, keyingi
          // odamni shu terminalga yubormaymiz.
          usedTerminals.add(item.terminalId);
        }
      }

      for (const batchId of changedBatches) {
        await this.history.refreshBatch(batchId);
      }

      if (dispatched > 0) {
        this.logger.log(
          `Sinxronlash navbatiga ${dispatched} ta vazifa yuborildi`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    } finally {
      if (locked && connected) {
        try {
          await runner.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
        } catch {
          // Ulanish uzilganda MySQL lockni
          // avtomatik bo‘shatadi.
        }
      }

      if (connected) {
        await runner.release();
      }

      this.running = false;

      if (this.rerun) {
        this.rerun = false;
        this.kick();
      }
    }
  }
}
