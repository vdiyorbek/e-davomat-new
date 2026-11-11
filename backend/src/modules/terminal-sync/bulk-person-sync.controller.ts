import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { PersonSyncBatchType } from './person-sync-batch.entity';

import { PersonSyncBatchItemStatus } from './person-sync-batch-item.entity';

import { PersonSyncHistoryService } from './person-sync-history.service';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from '../terminals/terminal.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';

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

interface PersonSyncJobData {
  terminalId: number;
  personId?: number;
  requestedByUserId?: number;
  historyItemId?: string;
}

@Controller('terminals/bulk')
@Roles(UserRole.SUPER_ADMIN)
export class BulkPersonSyncController {
  constructor(
    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue<PersonSyncJobData>,

    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,

    @InjectRepository(SchoolMembership)
    private readonly memberships: Repository<SchoolMembership>,

    private readonly history: PersonSyncHistoryService,
  ) {}

  @Post('person-sync')
  @HttpCode(200)
  async run(
    @Body() body: BulkSyncRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) throw new UnauthorizedException();

    if (
      !body ||
      !Array.isArray(body.terminalIds) ||
      body.terminalIds.length < 1 ||
      body.terminalIds.length > 5 ||
      body.terminalIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(body.terminalIds).size !== body.terminalIds.length
    ) {
      throw new BadRequestException(
        '1 dan 5 tagacha takrorlanmagan terminal tanlang',
      );
    }

    if (!['STUDENT', 'TEACHER', 'BOTH'].includes(body.type)) {
      throw new BadRequestException('Sinxronlash turi noto‘g‘ri');
    }

    if (!['ALL', 'LIMITED'].includes(body.mode)) {
      throw new BadRequestException('Sinxronlash rejimi noto‘g‘ri');
    }

    if (
      body.mode === 'LIMITED' &&
      (!Number.isInteger(body.limitPerTerminal) ||
        body.limitPerTerminal! < 1 ||
        body.limitPerTerminal! > 20)
    ) {
      throw new BadRequestException('Sinov rejimida limit 1–20 bo‘lishi kerak');
    }

    // To‘liq rejimni xavfsiz navbat dispatcheriga
    // ulashdan oldin ishga tushirmaymiz.
    if (body.mode === 'ALL' && !body.dryRun) {
      throw new BadRequestException(
        'To‘liq sinxronlash dispatcherini ulash talab etiladi',
      );
    }

    if (typeof body.dryRun !== 'boolean') {
      throw new BadRequestException('dryRun boolean bo‘lishi kerak');
    }

    if (body.dryRun === false && body.confirm !== 'SYNC_SELECTED_PERSONS') {
      throw new BadRequestException('Sinxronlash tasdiqlanmagan');
    }

    const terminals = await this.terminals.findBy({
      id: In(body.terminalIds),
    });

    if (terminals.length !== body.terminalIds.length) {
      throw new BadRequestException('Tanlangan terminallardan biri topilmadi');
    }

    if (
      terminals.some((terminal) => !terminal.isActive || terminal.archivedAt)
    ) {
      throw new BadRequestException(
        'Nofaol yoki arxivlangan terminal tanlangan',
      );
    }

    const todayParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const datePart = (name: string) =>
      todayParts.find((p) => p.type === name)?.value ?? '';

    const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;

    const types =
      body.type === 'BOTH'
        ? [MembershipType.STUDENT, MembershipType.TEACHER]
        : [body.type as MembershipType];

    const batch = body.dryRun
      ? null
      : await this.history.createBatch(
          actor.id,
          body.type as PersonSyncBatchType,
          body.terminalIds.length,
        );

    const results: Array<{
      terminalId: number;
      schoolId: number;
      candidates: number;
      hasMore: boolean;
      queued: number;
      reused: number;
      failed: number;
    }> = [];

    for (const terminalId of body.terminalIds) {
      const terminal = terminals.find((t) => t.id === terminalId)!;

      const query = this.memberships
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

      if (body.mode === 'LIMITED') {
        query.limit(body.limitPerTerminal! + 1);
      }

      const rows = await query.getRawMany<{
        personId: number | string;
      }>();

      const hasMore =
        body.mode === 'LIMITED' && rows.length > body.limitPerTerminal!;

      const selectedRows =
        body.mode === 'LIMITED' ? rows.slice(0, body.limitPerTerminal!) : rows;

      const personIds = selectedRows.map((row) => Number(row.personId));

      let queued = 0;
      let reused = 0;
      let failed = 0;

      if (!body.dryRun && batch) {
        for (const personId of personIds) {
          const item = await this.history.createItem(
            batch.id,
            terminalId,
            personId,
          );

          // Har bir tarix elementi uchun alohida BullMQ job.
          const jobId = `psh-${item.id}`;

          try {
            await this.queue.add(
              PERSON_SYNC_JOB.SYNC_PERSON,
              {
                terminalId,
                personId,
                requestedByUserId: actor.id,
                historyItemId: item.id,
              },
              {
                jobId,
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 15_000,
                },
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

            await this.history.markQueued(item.id, jobId);
            queued++;
          } catch (error: unknown) {
            failed++;

            // Redisga qo‘shish noaniq yakunlangan bo‘lsa,
            // job haqiqatda mavjudligini tekshiramiz.
            const existing = await this.queue.getJob(jobId).catch(() => null);

            if (existing) {
              await this.history.markQueued(item.id, jobId);
              queued++;
              failed--;
            } else {
              await this.history.markFinished(
                item.id,
                PersonSyncBatchItemStatus.UNCERTAIN,
                'QUEUE_SUBMISSION_UNCONFIRMED',
              );
            }
          }
        }
      }

      results.push({
        terminalId,
        schoolId: terminal.schoolId,
        candidates: personIds.length,
        hasMore,
        queued,
        reused,
        failed,
      });
    }
    if (batch) {
      await this.history.refreshBatch(batch.id);
    }
    return {
      success: results.every((item) => item.failed === 0),
      dryRun: body.dryRun,
      type: body.type,
      batchId: batch?.id ?? null,
      results,
      checkedAt: new Date().toISOString(),
    };
  }
}
