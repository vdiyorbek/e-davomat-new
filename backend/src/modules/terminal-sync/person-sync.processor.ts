import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';
import { PersonSyncService } from '../terminals/person-sync.service';

interface PersonSyncQueueJob {
  terminalId: number;
  personId?: number;
}

@Processor(PERSON_SYNC_QUEUE, {
  concurrency: 1,
})
export class PersonSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PersonSyncProcessor.name);

  constructor(private readonly personSyncService: PersonSyncService) {
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
        const result = await this.personSyncService.scanMissingTeachersForQueue(
          job.data.terminalId,
        );

        this.logger.log(
          `Terminal ${result.terminalId}: ` +
            `o‘qituvchilar=${result.databaseTeachers}, ` +
            `yetishmaydi=${result.missingCount}`,
        );

        return result;
      }

      case PERSON_SYNC_JOB.SYNC_PERSON:
        // Hozircha terminalga yozishni
        // navbat orqali yoqmaymiz.
        throw new Error('SYNC_PERSON navbat orqali hali yoqilmagan');

      default:
        throw new Error('Noma’lum PersonSync vazifasi');
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PersonSyncQueueJob> | undefined, error: Error): void {
    this.logger.warn(
      `PersonSync terminal=${job?.data?.terminalId ?? '?'}; ` +
        `vazifa=${job?.name ?? '?'}; ` +
        `xatolik=${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(): void {
    this.logger.error('PersonSync worker xatosi. Redis ulanishini tekshiring');
  }
}
