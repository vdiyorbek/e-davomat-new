import { Logger, HttpException } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonSyncTerminalLockService } from './person-sync-terminal-lock.service';
import { Terminal } from '../terminals/terminal.entity';
import { PersonSyncService } from '../terminals/person-sync.service';
import { Job, UnrecoverableError } from 'bullmq';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { User } from '../users/user.entity';
import { PersonSyncHistoryService } from './person-sync-history.service';
import { PersonSyncDispatcherService } from './person-sync-dispatcher.service';
import { PersonSyncBatchItemStatus } from './person-sync-batch-item.entity';
import { UserRole } from '../users/enums/user-role.enum';
import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';
import {
  TerminalPersonSyncCheck,
  TerminalPersonSyncCheckStatus,
} from './terminal-person-sync-check.entity';

interface PersonSyncQueueJob {
  terminalId: number;
  personId?: number;
  requestedByUserId?: number;
  historyItemId?: string;
}

interface CheckRecordInput {
  terminalId: number;
  jobId: string | null;
  status: TerminalPersonSyncCheckStatus;
  durationMs: number;
  databaseTeachers?: number | null;
  terminalUsers?: number | null;
  missingCount?: number | null;
  invalidPnfl?: number | null;
  errorCode?: string | null;
}

@Processor(PERSON_SYNC_QUEUE, {
  concurrency: 3,
})
export class PersonSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PersonSyncProcessor.name);

  constructor(
    private readonly personSyncService: PersonSyncService,

    @InjectRepository(TerminalPersonSyncCheck)
    private readonly checksRepository: Repository<TerminalPersonSyncCheck>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly terminalLock: PersonSyncTerminalLockService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly history: PersonSyncHistoryService,

    private readonly dispatcher: PersonSyncDispatcherService,
  ) {
    super();
  }

  async process(job: Job<PersonSyncQueueJob>): Promise<unknown> {
    if (
      !job.data ||
      !Number.isInteger(job.data.terminalId) ||
      job.data.terminalId <= 0
    ) {
      throw new Error('Terminal ID noto‘g‘ri');
    }

    switch (job.name) {
      case PERSON_SYNC_JOB.CHECK_TERMINAL: {
        const terminalId = job.data.terminalId;

        const locked = await this.terminalLock.run(terminalId, (assertOwned) =>
          this.processTerminalCheck(job, assertOwned),
        );

        if (!locked.acquired) {
          this.logger.warn(
            `PersonSync SKIPPED: terminal=${terminalId}, ` +
              `reason=CHECK_ALREADY_RUNNING`,
          );

          // Redis job completed bo‘ladi, lekin
          // monitoringga SUCCESS yozilmaydi.
          return {
            terminalId,
            skipped: true,
            reason: 'CHECK_ALREADY_RUNNING',
          };
        }

        return locked.result;
      }

      case PERSON_SYNC_JOB.SYNC_PERSON: {
        const terminalId = job.data.terminalId;
        const personId = job.data.personId;
        const requestedBy = job.data.requestedByUserId;
        const historyItemId = job.data.historyItemId;

        if (
          typeof personId !== 'number' ||
          !Number.isInteger(personId) ||
          personId <= 0 ||
          typeof requestedBy !== 'number' ||
          !Number.isInteger(requestedBy) ||
          requestedBy <= 0
        ) {
          throw new UnrecoverableError(
            'SYNC_PERSON uchun personId va requestedByUserId kerak',
          );
        }

        // Eski, tarixsiz joblar ham ishlashda davom etadi.
        if (historyItemId) {
          await this.history.markRunning(historyItemId, job.attemptsMade + 1);
        }

        try {
          return await this.processSyncPerson(
            job,
            terminalId,
            personId,
            requestedBy,
            historyItemId,
          );
        } finally {
          // Yozuv yakunlangan bo‘lsa, shu terminalning keyingi
          // shaxsini 5 soniya kutmasdan darhol navbatga qo‘yamiz.
          if (historyItemId) {
            this.dispatcher.kick();
          }
        }
      }

      default:
        throw new Error('Noma’lum PersonSync vazifasi');
    }
  }

  private async processSyncPerson(
    job: Job<PersonSyncQueueJob>,
    terminalId: number,
    personId: number,
    requestedBy: number,
    historyItemId: string | undefined,
  ): Promise<unknown> {
    try {
      const actor = await this.loadSyncActor(requestedBy);

      const locked = await this.terminalLock.run(terminalId, () =>
        this.personSyncService.syncPerson(terminalId, personId, actor),
      );

      if (!locked.acquired) {
        throw new Error('TERMINAL_BUSY');
      }

      const result = locked.result as {
        action?: string;
        status?: string;
        reason?: string;
      };

      if (result.action === 'BLOCKED' || result.action === 'MANUAL_REVIEW') {
        if (historyItemId) {
          await this.history.markFinished(
            historyItemId,
            PersonSyncBatchItemStatus.SKIPPED,
            result.reason?.slice(0, 100) ?? null,
          );
        }

        return result;
      }

      if (result.status !== 'VERIFIED') {
        if (historyItemId) {
          await this.history.markFinished(
            historyItemId,
            PersonSyncBatchItemStatus.UNCERTAIN,
            'NOT_VERIFIED',
          );
        }

        return result;
      }

      if (historyItemId) {
        await this.history.markFinished(
          historyItemId,
          PersonSyncBatchItemStatus.SUCCESS,
        );
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      const errorCode = this.getSyncErrorCode(error);

      const uncertain =
        errorCode === 'SYNC_RESULT_UNCERTAIN' ||
        errorCode === 'SYNC_RECONCILIATION_REQUIRED';

      if (historyItemId && uncertain) {
        await this.history.markFinished(
          historyItemId,
          PersonSyncBatchItemStatus.UNCERTAIN,
          'SYNC_RECONCILIATION_REQUIRED',
        );

        // Qurilmaga yozilgan bo‘lishi mumkin.
        // Avtomatik qayta yubormaymiz.
        throw new UnrecoverableError(
          'Sinxronlash natijasi noaniq. Qo‘lda tekshirish kerak',
        );
      }

      const maxAttempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt =
        error instanceof UnrecoverableError ||
        job.attemptsMade + 1 >= maxAttempts;

      if (historyItemId && isFinalAttempt) {
        await this.history.markFinished(
          historyItemId,
          PersonSyncBatchItemStatus.FAILED,
          errorCode,
        );
      }

      throw error;
    }
  }

  private getSyncErrorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (
        response !== null &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('TERMINAL_BUSY')) {
      return 'TERMINAL_BUSY';
    }

    if (/timeout|ETIMEDOUT|ECONNABORTED/i.test(message)) {
      return 'TIMEOUT';
    }

    if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(message)) {
      return 'CONNECTION_ERROR';
    }

    return 'SYNC_FAILED';
  }

  /** Vazifani yuborgan foydalanuvchi hali ham faol SUPER_ADMIN bo'lishi shart. */
  private async loadSyncActor(userId: number): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user || !user.isActive || user.role !== UserRole.SUPER_ADMIN) {
      throw new UnrecoverableError(
        'Vazifani yuborgan foydalanuvchi endi faol SUPER_ADMIN emas',
      );
    }

    return {
      id: user.id,
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      schoolId: user.schoolId,
      photoUrl: null,
    };
  }

  private async processTerminalCheck(
    job: Job<PersonSyncQueueJob>,
    assertOwned: () => Promise<void>,
  ): Promise<unknown> {
    const terminalId = job.data.terminalId;
    const startedAt = Date.now();
    const jobId = job.id ? String(job.id) : null;

    this.logger.log(
      `PersonSync START: terminal=${terminalId}, ` +
        `jobId=${jobId ?? '-'}, pid=${process.pid}`,
    );

    let result: Awaited<
      ReturnType<PersonSyncService['scanMissingTeachersForQueue']>
    >;

    try {
      result =
        await this.personSyncService.scanMissingTeachersForQueue(terminalId);
    } catch (error: unknown) {
      // Terminalni tekshirish tugadi.
      // MySQL'ga SUCCESS yozishdan avval
      // lock hali bizga tegishli ekanini tekshiramiz.
      await assertOwned();
      const durationMs = Date.now() - startedAt;
      const errorCode = this.classifyError(error);

      // Monitoringga yozishdagi xato asl
      // terminal xatosini almashtirmasligi kerak.
      try {
        await this.saveCheck({
          terminalId,
          jobId,
          status:
            errorCode === 'TIMEOUT'
              ? TerminalPersonSyncCheckStatus.TIMEOUT
              : TerminalPersonSyncCheckStatus.ERROR,
          durationMs,
          errorCode,
        });
      } catch (databaseError: unknown) {
        this.logger.error(
          `Monitoringni MySQL'ga yozib bo‘lmadi: ` +
            `terminal=${terminalId}, ` +
            `error=${
              databaseError instanceof Error
                ? databaseError.message
                : String(databaseError)
            }`,
        );
      }

      this.logger.warn(
        `PersonSync FAILED: terminal=${terminalId}, ` +
          `durationMs=${durationMs}, ` +
          `errorCode=${errorCode}`,
      );

      // BullMQ bu vazifani failed deb qayd etadi.
      throw error;
    }

    const durationMs = Date.now() - startedAt;

    // Terminal o‘rtada nofaol bo‘lib qolgan
    // bo‘lsa, uni SUCCESS deb hisoblamaymiz.
    const status = result.skipped
      ? TerminalPersonSyncCheckStatus.ERROR
      : TerminalPersonSyncCheckStatus.SUCCESS;

    await this.saveCheck({
      terminalId,
      jobId,
      status,
      durationMs,
      databaseTeachers: result.skipped ? null : result.databaseTeachers,
      terminalUsers: result.skipped ? null : result.terminalUsers,
      missingCount: result.skipped ? null : result.missingCount,
      invalidPnfl: result.skipped ? null : (result.invalidPnfl ?? 0),
      errorCode: result.skipped ? (result.reason ?? 'TERMINAL_SKIPPED') : null,
    });

    this.logger.log(
      `PersonSync FINISHED: terminal=${terminalId}, ` +
        `status=${status}, ` +
        `durationMs=${durationMs}, ` +
        `missing=${result.missingCount}`,
    );

    return result;
  }

  private async saveCheck(input: CheckRecordInput): Promise<void> {
    const terminal = await this.terminalsRepository.findOne({
      where: {
        id: input.terminalId,
      },
      select: {
        id: true,
        schoolId: true,
      },
    });

    if (!terminal) {
      throw new Error(`Terminal ${input.terminalId} topilmadi`);
    }

    const record = this.checksRepository.create({
      terminalId: input.terminalId,
      schoolId: terminal.schoolId,
      status: input.status,
      jobId: input.jobId,
      durationMs: input.durationMs,
      databaseTeachers: input.databaseTeachers ?? null,
      terminalUsers: input.terminalUsers ?? null,
      missingCount: input.missingCount ?? null,
      invalidPnfl: input.invalidPnfl ?? null,
      errorCode: input.errorCode ?? null,
      checkedAt: new Date(),
    });

    await this.checksRepository.save(record);
  }

  private classifyError(error: unknown): string {
    const value = error instanceof Error ? error.message : String(error);

    if (/timeout|ECONNABORTED|ETIMEDOUT/i.test(value)) {
      return 'TIMEOUT';
    }

    if (/ECONNREFUSED/i.test(value)) {
      return 'CONNECTION_REFUSED';
    }

    if (/EHOSTUNREACH|ENETUNREACH/i.test(value)) {
      return 'NETWORK_UNREACHABLE';
    }

    if (/HTTP 401|HTTP 403|Digest/i.test(value)) {
      return 'AUTH_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PersonSyncQueueJob> | undefined, error: Error): void {
    this.logger.warn(
      `PersonSync job failed: ` +
        `terminal=${job?.data?.terminalId ?? '?'}, ` +
        `jobId=${job?.id ?? '?'}, ` +
        `error=${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(): void {
    this.logger.error('PersonSync worker xatosi. Redis ulanishini tekshiring');
  }
}
