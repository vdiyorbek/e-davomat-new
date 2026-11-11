import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import {
  PersonSyncBatch,
  PersonSyncBatchStatus,
  PersonSyncBatchType,
} from './person-sync-batch.entity';
import {
  PersonSyncBatchItem,
  PersonSyncBatchItemStatus,
} from './person-sync-batch-item.entity';

type SyncType = 'STUDENT' | 'TEACHER' | 'BOTH';
type SyncMode = 'ALL' | 'LIMITED';

interface BulkSyncRequest {
  terminalIds: number[];
  type: SyncType;
  mode: SyncMode;
  limitPerTerminal?: number;
  dryRun: boolean;
  confirm?: string;
}

interface TerminalPlan {
  terminalId: number;
  schoolId: number;
  candidates: number;
  hasMore: boolean;
  queued: number;
  reused: number;
  failed: number;
}

function tashkentToday(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (name: string) =>
    parts.find((part) => part.type === name)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

@Controller('terminals/bulk')
@Roles(UserRole.SUPER_ADMIN)
export class BulkPersonSyncController {
  constructor(private readonly dataSource: DataSource) {}

  @Post('person-sync')
  @HttpCode(200)
  async run(
    @Body() body: BulkSyncRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    if (
      !body ||
      !Array.isArray(body.terminalIds) ||
      body.terminalIds.length < 1 ||
      body.terminalIds.length > 5 ||
      body.terminalIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(body.terminalIds).size !== body.terminalIds.length
    ) {
      throw new BadRequestException('1 dan 5 tagacha terminal tanlang');
    }

    if (!['STUDENT', 'TEACHER', 'BOTH'].includes(body.type)) {
      throw new BadRequestException('Sinxronlash turi noto‘g‘ri');
    }

    if (!['ALL', 'LIMITED'].includes(body.mode)) {
      throw new BadRequestException('Sinxronlash hajmi noto‘g‘ri');
    }

    if (typeof body.dryRun !== 'boolean') {
      throw new BadRequestException('dryRun boolean bo‘lishi kerak');
    }

    if (
      body.mode === 'LIMITED' &&
      (!Number.isInteger(body.limitPerTerminal) ||
        body.limitPerTerminal! < 1 ||
        body.limitPerTerminal! > 20)
    ) {
      throw new BadRequestException('Sinov limiti 1–20 bo‘lishi kerak');
    }

    if (!body.dryRun && body.confirm !== 'SYNC_SELECTED_PERSONS') {
      throw new BadRequestException('Sinxronlash tasdiqlanmagan');
    }

    const terminalIds = [...body.terminalIds].sort((a, b) => a - b);

    const types =
      body.type === 'BOTH'
        ? [MembershipType.STUDENT, MembershipType.TEACHER]
        : [body.type as MembershipType];

    const today = tashkentToday();

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    const acquiredLocks: string[] = [];

    try {
      // APPLY paytida terminal bo‘yicha DB lock.
      // Bu parallel so‘rovlarning ikki batch
      // yaratishiga yo‘l qo‘ymaslik uchun.
      if (!body.dryRun) {
        for (const terminalId of terminalIds) {
          const lockName = `edav:person-sync:${terminalId}`;

          const rows: Array<{ acquired: number }> = await runner.query(
            'SELECT GET_LOCK(?, 10) AS acquired',
            [lockName],
          );

          if (Number(rows[0]?.acquired) !== 1) {
            throw new ConflictException(`Terminal ${terminalId} band`);
          }

          acquiredLocks.push(lockName);
        }

        await runner.startTransaction();
      }

      const selectedTerminals = await runner.manager
        .getRepository(Terminal)
        .findBy({
          id: In(terminalIds),
        });

      if (selectedTerminals.length !== terminalIds.length) {
        throw new BadRequestException('Terminallardan biri topilmadi');
      }

      if (
        selectedTerminals.some(
          (terminal) => !terminal.isActive || terminal.archivedAt,
        )
      ) {
        throw new BadRequestException(
          'Nofaol yoki arxivlangan terminal tanlangan',
        );
      }

      const plans: Array<TerminalPlan & { personIds: number[] }> = [];

      for (const terminalId of terminalIds) {
        const terminal = selectedTerminals.find(
          (item) => item.id === terminalId,
        )!;

        if (!body.dryRun) {
          // Oldingi faol batch bo‘lsa,
          // ikkinchi batch yaratmaymiz.
          const active = await runner.manager
            .getRepository(PersonSyncBatch)
            .createQueryBuilder('batch')
            .innerJoin(PersonSyncBatchItem, 'item', 'item.batchId = batch.id')
            .where('item.terminalId = :terminalId', {
              terminalId,
            })
            .andWhere('batch.status IN (:...statuses)', {
              statuses: [
                PersonSyncBatchStatus.QUEUING,
                PersonSyncBatchStatus.QUEUED,
                PersonSyncBatchStatus.RUNNING,
              ],
            })
            .getOne();

          if (active) {
            throw new ConflictException(
              `Terminal ${terminalId} uchun ` +
                `#${active.id} topshiriq davom etmoqda`,
            );
          }
        }

        const query = runner.manager
          .getRepository(SchoolMembership)
          .createQueryBuilder('membership')
          .innerJoin('membership.person', 'person')
          .select('membership.personId', 'personId')
          .distinct(true)
          .where('membership.schoolId = :schoolId', {
            schoolId: terminal.schoolId,
          })
          .andWhere('membership.type IN (:...types)', {
            types,
          })
          .andWhere('membership.startDate <= :today', {
            today,
          })
          .andWhere(
            '(membership.endDate IS NULL OR membership.endDate > :today)',
            { today },
          )
          .andWhere('person.deletedAt IS NULL')
          .orderBy('membership.personId', 'ASC');

        const limit = body.mode === 'LIMITED' ? body.limitPerTerminal! : null;

        if (limit !== null) {
          query.limit(limit + 1);
        }

        const rows = await query.getRawMany<{
          personId: number | string;
        }>();

        const hasMore = limit !== null && rows.length > limit;

        const personIds = (limit !== null ? rows.slice(0, limit) : rows).map(
          (row) => Number(row.personId),
        );

        if (personIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
          throw new BadRequestException('Shaxs ID ma’lumotlari noto‘g‘ri');
        }

        plans.push({
          terminalId,
          schoolId: terminal.schoolId,
          candidates: personIds.length,
          hasMore,
          queued: 0,
          reused: 0,
          failed: 0,
          personIds,
        });
      }

      if (body.dryRun) {
        return {
          success: true,
          dryRun: true,
          type: body.type,
          mode: body.mode,
          batchId: null,
          results: plans.map(({ personIds: _personIds, ...plan }) => plan),
          checkedAt: new Date().toISOString(),
        };
      }

      const batchRepository = runner.manager.getRepository(PersonSyncBatch);

      const batch = await batchRepository.save(
        batchRepository.create({
          requestedByUserId: actor.id,
          type: body.type as PersonSyncBatchType,
          terminalCount: terminalIds.length,
          totalItems: plans.reduce(
            (sum, plan) => sum + plan.personIds.length,
            0,
          ),
          queuedItems: 0,
          status: PersonSyncBatchStatus.QUEUING,
          finishedAt: null,
        }),
      );

      const itemRepository = runner.manager.getRepository(PersonSyncBatchItem);

      for (const plan of plans) {
        for (let offset = 0; offset < plan.personIds.length; offset += 200) {
          const chunk = plan.personIds.slice(offset, offset + 200);

          await itemRepository.insert(
            chunk.map((personId) => ({
              batchId: batch.id,
              terminalId: plan.terminalId,
              personId,
              jobId: null,
              status: PersonSyncBatchItemStatus.PENDING,
              attempts: 0,
              errorCode: null,
              startedAt: null,
              finishedAt: null,
            })),
          );
        }
      }

      // Barcha itemlar saqlangandan so‘nggina
      // dispatcher uchun ochamiz.
      await batchRepository.update(
        { id: batch.id },
        {
          status: PersonSyncBatchStatus.QUEUED,
        },
      );

      await runner.commitTransaction();

      return {
        success: true,
        dryRun: false,
        type: body.type,
        mode: body.mode,
        batchId: batch.id,
        results: plans.map(({ personIds, ...plan }) => ({
          ...plan,
          scheduled: personIds.length,
        })),
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw error;
    } finally {
      for (const lockName of acquiredLocks.reverse()) {
        try {
          await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch {
          // Connection uzilgan bo‘lsa,
          // MySQL advisory lockni o‘zi bo‘shatadi.
        }
      }

      await runner.release();
    }
  }
}
