import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
      { id: itemId },
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
    await this.items.update(
      { id: itemId },
      {
        status,
        errorCode,
        finishedAt: new Date(),
      },
    );

    const item = await this.items.findOneBy({ id: itemId });

    if (item) {
      await this.refreshBatch(item.batchId);
    }
  }

  async refreshBatch(batchId: string): Promise<void> {
    const batch = await this.batches.findOneBy({ id: batchId });
    if (!batch) return;

    const all = await this.items.find({
      where: { batchId },
      select: { status: true },
    });

    const total = all.length;

    const queued = all.filter(
      (item) => item.status !== PersonSyncBatchItemStatus.PENDING,
    ).length;

    const finished = all.filter((item) =>
      [
        PersonSyncBatchItemStatus.SUCCESS,
        PersonSyncBatchItemStatus.SKIPPED,
        PersonSyncBatchItemStatus.FAILED,
        PersonSyncBatchItemStatus.UNCERTAIN,
      ].includes(item.status),
    ).length;

    const hasProblems = all.some((item) =>
      [
        PersonSyncBatchItemStatus.FAILED,
        PersonSyncBatchItemStatus.UNCERTAIN,
      ].includes(item.status),
    );

    let status: PersonSyncBatchStatus;
    let finishedAt: Date | null = null;

    if (total === 0) {
      status = PersonSyncBatchStatus.COMPLETED;
      finishedAt = new Date();
    } else if (finished === total) {
      status = hasProblems
        ? PersonSyncBatchStatus.PARTIAL
        : PersonSyncBatchStatus.COMPLETED;
      finishedAt = new Date();
    } else if (
      all.some((item) => item.status === PersonSyncBatchItemStatus.RUNNING)
    ) {
      status = PersonSyncBatchStatus.RUNNING;
    } else {
      status = PersonSyncBatchStatus.QUEUED;
    }

    await this.batches.update(
      { id: batchId },
      {
        totalItems: total,
        queuedItems: queued,
        status,
        finishedAt,
      },
    );
  }
}
