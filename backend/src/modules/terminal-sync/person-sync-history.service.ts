import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  PersonSyncBatch,
  PersonSyncBatchStatus,
  PersonSyncBatchType,
} from './person-sync-batch.entity';

import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus as Status,
} from './person-sync-batch-item.entity';

type FinalStatus =
  Status.SUCCESS | Status.SKIPPED | Status.FAILED | Status.UNCERTAIN;

const ACTIVE_STATUSES = [Status.PENDING, Status.QUEUED, Status.RUNNING];

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
        status: Status.PENDING,
        attempts: 0,
        errorCode: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
  }

  // Barcha status o'zgarishlari:
  // 1. Batchni bloklash
  // 2. Itemni bloklash
  // 3. Statusni yangilash
  // 4. Batch hisoblagichlarini yangilash
  //
  // Hammasi bitta tranzaksiyada amalga oshadi.
  private async changeItem(
    itemId: string,
    change: (
      item: PersonSyncBatchItem,
      manager: EntityManager,
    ) => Promise<boolean>,
  ): Promise<void> {
    await this.batches.manager.transaction(
      'READ COMMITTED',
      async (manager) => {
        // BatchId o'zgarmas maydon.
        // Dastlab faqat qaysi batch ekanini aniqlaymiz.
        const reference = await manager.findOneBy(PersonSyncBatchItem, {
          id: itemId,
        });

        if (!reference) return;

        // Muhim: hamma joyda avval batch,
        // keyin item lock olinadi.
        const batch = await manager
          .getRepository(PersonSyncBatch)
          .createQueryBuilder('batch')
          .setLock('pessimistic_write')
          .where('batch.id = :batchId', {
            batchId: reference.batchId,
          })
          .getOne();

        if (!batch) return;

        const item = await manager
          .getRepository(PersonSyncBatchItem)
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where('item.id = :itemId', { itemId })
          .getOne();

        if (!item) return;

        const changed = await change(item, manager);

        if (!changed) return;

        await this.refreshBatchLocked(manager, batch);
      },
    );
  }

  async markQueued(itemId: string, jobId: string): Promise<void> {
    await this.changeItem(itemId, async (item, manager) => {
      // Worker tezroq yakunlagan bo'lsa,
      // statusni orqaga qaytarmaymiz.
      if (item.status !== Status.PENDING) {
        return false;
      }

      await manager.update(
        PersonSyncBatchItem,
        { id: item.id },
        {
          jobId,
          status: Status.QUEUED,
        },
      );

      return true;
    });
  }

  async markRunning(itemId: string, attempts: number): Promise<void> {
    await this.changeItem(itemId, async (item, manager) => {
      if (!ACTIVE_STATUSES.includes(item.status)) {
        return false;
      }

      await manager.update(
        PersonSyncBatchItem,
        { id: item.id },
        {
          status: Status.RUNNING,
          attempts: Math.max(item.attempts, attempts),
          startedAt: item.startedAt ?? new Date(),
        },
      );

      return true;
    });
  }

  async markFinished(
    itemId: string,
    status: Status,
    errorCode: string | null = null,
  ): Promise<void> {
    const allowed: Status[] = [
      Status.SUCCESS,
      Status.SKIPPED,
      Status.FAILED,
      Status.UNCERTAIN,
    ];

    if (!allowed.includes(status)) {
      throw new Error(`Yakuniy status noto‘g‘ri: ${status}`);
    }

    const finalStatus = status as FinalStatus;

    await this.changeItem(itemId, async (item, manager) => {
      // Yakuniy holat qayta yozilmaydi.
      if (!ACTIVE_STATUSES.includes(item.status)) {
        return false;
      }

      await manager.update(
        PersonSyncBatchItem,
        { id: item.id },
        {
          status: finalStatus,
          errorCode: errorCode?.slice(0, 100) ?? null,
          finishedAt: new Date(),
        },
      );

      return true;
    });
  }

  async refreshBatch(batchId: string): Promise<void> {
    await this.batches.manager.transaction(
      'READ COMMITTED',
      async (manager) => {
        const batch = await manager
          .getRepository(PersonSyncBatch)
          .createQueryBuilder('batch')
          .setLock('pessimistic_write')
          .where('batch.id = :batchId', { batchId })
          .getOne();

        if (!batch) return;

        await this.refreshBatchLocked(manager, batch);
      },
    );
  }

  // Bu metod faqat batch lock olingan
  // tranzaksiya ichidan chaqiriladi.
  private async refreshBatchLocked(
    manager: EntityManager,
    batch: PersonSyncBatch,
  ): Promise<void> {
    if (batch.status === PersonSyncBatchStatus.QUEUING) {
      return;
    }

    const rows = await manager
      .getRepository(PersonSyncBatchItem)
      .createQueryBuilder('item')
      .select('item.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('item.batchId = :batchId', {
        batchId: batch.id,
      })
      .groupBy('item.status')
      .getRawMany<{
        status: Status;
        count: string;
      }>();

    const counts = new Map<Status, number>();
    let total = 0;

    for (const row of rows) {
      const count = Number(row.count);
      counts.set(row.status, count);
      total += count;
    }

    const get = (status: Status) => counts.get(status) ?? 0;

    const pending = get(Status.PENDING);
    const running = get(Status.RUNNING);

    const success = get(Status.SUCCESS);
    const skipped = get(Status.SKIPPED);
    const failed = get(Status.FAILED);
    const uncertain = get(Status.UNCERTAIN);

    const finished = success + skipped + failed + uncertain;

    const allFinished = total === 0 || finished === total;

    let status: PersonSyncBatchStatus;
    let finishedAt: Date | null = null;

    if (allFinished) {
      status =
        failed > 0 || uncertain > 0
          ? PersonSyncBatchStatus.PARTIAL
          : PersonSyncBatchStatus.COMPLETED;

      finishedAt = batch.finishedAt ?? new Date();
    } else if (running > 0) {
      status = PersonSyncBatchStatus.RUNNING;
    } else {
      status = PersonSyncBatchStatus.QUEUED;
    }

    await manager.update(
      PersonSyncBatch,
      { id: batch.id },
      {
        totalItems: total,
        queuedItems: total - pending,
        status,
        finishedAt,
      },
    );
  }
}
