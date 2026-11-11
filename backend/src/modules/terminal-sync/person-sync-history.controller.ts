import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';
import { Person } from '../persons/person.entity';
import {
  PersonSyncBatch,
  PersonSyncBatchStatus,
} from './person-sync-batch.entity';
import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus,
} from './person-sync-batch-item.entity';

const STATUSES = Object.values(PersonSyncBatchStatus);

export function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;

  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException('Musbat butun son kiriting');
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new BadRequestException('Son belgilangan chegaradan oshdi');
  }

  return number;
}

@Controller('person-sync-queue/history')
@Roles(UserRole.SUPER_ADMIN)
export class PersonSyncHistoryController {
  constructor(
    @InjectRepository(PersonSyncBatch)
    private readonly batches: Repository<PersonSyncBatch>,

    @InjectRepository(PersonSyncBatchItem)
    private readonly items: Repository<PersonSyncBatchItem>,

    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
  ) {}

  @Get()
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('terminalId') terminalIdRaw?: string,
  ) {
    const page = positiveInteger(pageRaw, 1, 1000000);
    const limit = positiveInteger(limitRaw, 20, 100);
    const status = statusRaw || 'ALL';

    if (
      status !== 'ALL' &&
      !STATUSES.includes(status as PersonSyncBatchStatus)
    ) {
      throw new BadRequestException('Noto‘g‘ri holat');
    }

    const terminalId =
      terminalIdRaw === undefined || terminalIdRaw === ''
        ? null
        : positiveInteger(terminalIdRaw, 1, 4294967295);

    const qb = this.batches.createQueryBuilder('batch');

    if (status !== 'ALL') {
      qb.andWhere('batch.status = :status', { status });
    }

    if (terminalId !== null) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM person_sync_batch_items item
          WHERE item.batchId = batch.id
            AND item.terminalId = :terminalId
        )`,
        { terminalId },
      );
    }

    const [rows, totalItems] = await qb
      .orderBy('batch.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const ids = rows.map((batch) => batch.id);

    const counts = ids.length
      ? await this.items
          .createQueryBuilder('item')
          .select('item.batchId', 'batchId')
          .addSelect('item.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('item.batchId IN (:...ids)', { ids })
          .groupBy('item.batchId')
          .addGroupBy('item.status')
          .getRawMany<{
            batchId: string;
            status: string;
            count: string;
          }>()
      : [];

    const byBatch = new Map<string, Record<string, number>>();

    for (const item of counts) {
      const current = byBatch.get(item.batchId) ?? {};
      current[item.status] = Number(item.count);
      byBatch.set(item.batchId, current);
    }

    return {
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
      batches: rows.map((batch) => ({
        id: batch.id,
        requestedByUserId: batch.requestedByUserId,
        type: batch.type,
        status: batch.status,
        terminalCount: batch.terminalCount,
        totalItems: batch.totalItems,
        queuedItems: batch.queuedItems,
        createdAt: batch.createdAt,
        finishedAt: batch.finishedAt,
        counts: byBatch.get(batch.id) ?? {},
      })),
    };
  }

  @Get(':batchId')
  async detail(
    @Param('batchId') batchId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') statusRaw?: string,
  ) {
    if (!/^[1-9]\d*$/.test(batchId)) {
      throw new BadRequestException('Topshiriq ID noto‘g‘ri');
    }

    const page = positiveInteger(pageRaw, 1, 1000000);
    const limit = positiveInteger(limitRaw, 20, 100);

    const batch = await this.batches.findOneBy({ id: batchId });

    if (!batch) {
      throw new NotFoundException('Topshiriq topilmadi');
    }

    // Ixtiyoriy: faqat ma’lum holatdagi yozuvlarni ko‘rsatish.
    const itemStatus = statusRaw && statusRaw !== 'ALL' ? statusRaw : undefined;

    if (
      itemStatus !== undefined &&
      !Object.values(PersonSyncBatchItemStatus).includes(
        itemStatus as PersonSyncBatchItemStatus,
      )
    ) {
      throw new BadRequestException('Holat noto‘g‘ri');
    }

    const [items, totalItems] = await this.items.findAndCount({
      where: {
        batchId,
        ...(itemStatus
          ? { status: itemStatus as PersonSyncBatchItemStatus }
          : {}),
      },
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const terminalIds = [...new Set(items.map((item) => item.terminalId))];

    const terminals = terminalIds.length
      ? await this.terminals.findBy({
          id: In(terminalIds),
        })
      : [];

    const terminalNames = new Map(
      terminals.map((terminal) => [terminal.id, terminal.name]),
    );

    // Jadvalda faqat ID emas, shaxsning F.I.Sh. ko‘rinishi uchun.
    // `withDeleted` — o‘chirilgan shaxslarning tarixi ham o‘qilsin.
    const personIds = [...new Set(items.map((item) => item.personId))];

    const persons = personIds.length
      ? await this.items.manager.getRepository(Person).find({
          where: { id: In(personIds) },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
          withDeleted: true,
        })
      : [];

    const personNames = new Map(
      persons.map((person) => [
        person.id,
        [person.lastName, person.firstName, person.middleName]
          .filter(Boolean)
          .join(' '),
      ]),
    );

    const counts = await this.items
      .createQueryBuilder('item')
      .select('item.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('item.batchId = :batchId', { batchId })
      .groupBy('item.status')
      .getRawMany<{ status: string; count: string }>();

    return {
      batch,
      counts: Object.fromEntries(
        counts.map((item) => [item.status, Number(item.count)]),
      ),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
      items: items.map((item) => ({
        id: item.id,
        terminalId: item.terminalId,
        terminalName: terminalNames.get(item.terminalId) ?? null,
        personId: item.personId,
        personName: personNames.get(item.personId) ?? null,
        jobId: item.jobId,
        status: item.status,
        attempts: item.attempts,
        errorCode: item.errorCode,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        createdAt: item.createdAt,
      })),
    };
  }
}
