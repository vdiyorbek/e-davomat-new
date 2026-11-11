import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  PersonSyncBatch,
  PersonSyncBatchStatus,
  PersonSyncBatchType,
} from './person-sync-batch.entity';

import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus,
} from './person-sync-batch-item.entity';

@Injectable()
export class PersonSyncHistoryService {
  constructor(
    @InjectRepository(PersonSyncBatch)
    private readonly batches: Repository<PersonSyncBatch>,

    @InjectRepository(PersonSyncBatchItem)
    private readonly items: Repository<PersonSyncBatchItem>,
  ) {}

  async createBatch(
    requestedByUserId: number,
    type: PersonSyncBatchType,
    terminalCount: number,
  ): Promise<PersonSyncBatch> {
    return this.batches.save(
      this.batches.create({
        requestedByUserId,
        type,
        terminalCount,
        totalItems: 0,
        queuedItems: 0,
        status: PersonSyncBatchStatus.QUEUING,
        finishedAt: null,
      }),
    );
  }

  async createItem(
    batchId: string,
    terminalId: number,
    personId: number,
  ): Promise<PersonSyncBatchItem> {
    return this.items.save(
      this.items.create({
        batchId,
        terminalId,
        personId,
        jobId: null,
        status: PersonSyncBatchItemStatus.PENDING,
        attempts: 0,
        errorCode: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
  }

  async markQueued(itemId: string, jobId: string): Promise<void> {
    await this.items.update(
      {
        id: itemId,
        status: PersonSyncBatchItemStatus.PENDING,
      },
      {
        jobId,
        status: PersonSyncBatchItemStatus.QUEUED,
      },
    );
  }

  async markRunning(itemId: string, attempts: number): Promise<void> {
    await this.items.update(
      {
        id: itemId,
        status: In([
          PersonSyncBatchItemStatus.PENDING,
          PersonSyncBatchItemStatus.QUEUED,
          PersonSyncBatchItemStatus.RUNNING,
        ]),
      },
      {
        status: PersonSyncBatchItemStatus.RUNNING,
        attempts,
        startedAt: new Date(),
      },
    );
  }

  async markFinished(
    itemId: string,
    status: PersonSyncBatchItemStatus,
    errorCode: string | null = null,
  ): Promise<void> {
    const finalStatuses = [
      PersonSyncBatchItemStatus.SUCCESS,
      PersonSyncBatchItemStatus.SKIPPED,
      PersonSyncBatchItemStatus.FAILED,
      PersonSyncBatchItemStatus.UNCERTAIN,
    ];

    if (!finalStatuses.includes(status)) {
      throw new Error(`Yakuniy status noto‘g‘ri: ${status}`);
    }

    const result = await this.items.update(
      {
        id: itemId,
        status: In([
          PersonSyncBatchItemStatus.PENDING,
          PersonSyncBatchItemStatus.QUEUED,
          PersonSyncBatchItemStatus.RUNNING,
        ]),
      },
      {
        status,
        errorCode,
        finishedAt: new Date(),
      },
    );

    if (result.affected !== 1) return;

    const item = await this.items.findOneBy({ id: itemId });

    if (item) {
      await this.refreshBatch(item.batchId);
    }
  }

  async refreshBatch(batchId: string): Promise<void> {
    await this.batches.manager.transaction(
      'READ COMMITTED',
      async (manager) => {
        const batchRepository = manager.getRepository(PersonSyncBatch);

        const itemRepository = manager.getRepository(PersonSyncBatchItem);

        // Bitta batch bo‘yicha parallel refresh
        // chaqiruvlarini navbatga qo‘yamiz.
        const batch = await batchRepository
          .createQueryBuilder('batch')
          .setLock('pessimistic_write')
          .where('batch.id = :batchId', { batchId })
          .getOne();

        if (!batch) return;

        // Batch hali shakllantirilayotgan bo‘lsa,
        // uning yakuniy holatini hisoblamaymiz.
        if (batch.status === PersonSyncBatchStatus.QUEUING) {
          return;
        }

        // Shaxslarni xotiraga yuklamaymiz.
        // Hisoblashni MySQL bajaradi.
        const rows = await itemRepository
          .createQueryBuilder('item')
          .select('item.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('item.batchId = :batchId', { batchId })
          .groupBy('item.status')
          .getRawMany<{
            status: PersonSyncBatchItemStatus;
            count: string;
          }>();

        const counts = new Map<PersonSyncBatchItemStatus, number>();

        let total = 0;

        for (const row of rows) {
          const count = Number(row.count);

          counts.set(row.status, count);
          total += count;
        }

        const get = (status: PersonSyncBatchItemStatus): number =>
          counts.get(status) ?? 0;

        const pending = get(PersonSyncBatchItemStatus.PENDING);

        const running = get(PersonSyncBatchItemStatus.RUNNING);

        const success = get(PersonSyncBatchItemStatus.SUCCESS);

        const skipped = get(PersonSyncBatchItemStatus.SKIPPED);

        const failed = get(PersonSyncBatchItemStatus.FAILED);

        const uncertain = get(PersonSyncBatchItemStatus.UNCERTAIN);

        const finished = success + skipped + failed + uncertain;

        const allFinished = total === 0 || finished === total;

        let status: PersonSyncBatchStatus;
        let finishedAt: Date | null = null;

        if (allFinished) {
          status =
            failed > 0 || uncertain > 0
              ? PersonSyncBatchStatus.PARTIAL
              : PersonSyncBatchStatus.COMPLETED;

          // Takroriy hisoblashda yakunlangan vaqtni
          // qaytadan o‘zgartirmaymiz.
          finishedAt = batch.finishedAt ?? new Date();
        } else if (running > 0) {
          status = PersonSyncBatchStatus.RUNNING;
        } else {
          // PENDING va QUEUED elementlar mavjud.
          status = PersonSyncBatchStatus.QUEUED;
        }

        await batchRepository.update(
          { id: batchId },
          {
            totalItems: total,
            queuedItems: total - pending,
            status,
            finishedAt,
          },
        );
      },
    );
  }
}
