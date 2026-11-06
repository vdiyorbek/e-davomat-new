import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { PersonSyncTerminalLockService } from './person-sync-terminal-lock.service';
import { Terminal } from '../terminals/terminal.entity';
import { PersonSyncService } from '../terminals/person-sync.service';

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

      case PERSON_SYNC_JOB.SYNC_PERSON:
        throw new Error('SYNC_PERSON navbat orqali hali yoqilmagan');

      default:
        throw new Error('Noma’lum PersonSync vazifasi');
    }
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
