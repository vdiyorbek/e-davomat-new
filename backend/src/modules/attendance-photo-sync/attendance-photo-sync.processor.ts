import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { AttendanceEventPhotosService } from '../attendance-events/attendance-event-photos.service';
import { SettingsService } from '../system-settings/settings.service';

import {
  ATTENDANCE_PHOTO_JOB,
  ATTENDANCE_PHOTO_QUEUE,
} from './attendance-photo-sync.constants';

import type { AttendancePhotoJob } from './attendance-photo-sync.constants';

@Processor(ATTENDANCE_PHOTO_QUEUE, {
  concurrency: 2,
})
export class AttendancePhotoSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendancePhotoSyncProcessor.name);

  constructor(
    private readonly photosService: AttendanceEventPhotosService,
    private readonly settings: SettingsService,
  ) {
    super();
  }

  async process(job: Job<AttendancePhotoJob>): Promise<void> {
    if (job.name !== ATTENDANCE_PHOTO_JOB) {
      throw new Error('Noma’lum rasm yuklash vazifasi');
    }

    const terminalId = job.data.terminalId;

    // Bir vaqtda nechta terminal ishlashi — tizim sozlamasidan (BullMQ ishchisi jonli o‘zgaradi).
    const workers = this.settings.getInt('photosWorkers');
    if (this.worker.concurrency !== workers) {
      this.worker.concurrency = workers;
    }

    if (!Number.isSafeInteger(terminalId) || terminalId <= 0) {
      throw new Error('Terminal ID noto‘g‘ri');
    }

    const startedAt = Date.now();

    let processed = 0;
    let downloaded = 0;
    let failed = 0;
    let missing = 0;

    // Paket hajmi, paketlar soni va vaqt chegarasi — tizim sozlamalaridan.
    const batchSize = this.settings.getInt('photosBatchSize');
    const maxBatches = this.settings.getInt('photosMaxBatches');
    const runMs = this.settings.getInt('photosRunSeconds') * 1000;

    for (let batch = 0; batch < maxBatches; batch += 1) {
      // Vaqt tugagach yangi paket boshlamaymiz.
      // Boshlangan paket oxirigacha bajariladi.
      if (Date.now() - startedAt >= runMs) {
        break;
      }

      const result = await this.photosService.downloadPending({
        terminalId,
        limit: batchSize,
      });

      for (const item of result.results) {
        if (item.message) {
          const message = item.message.replace(/[\r\n\t]+/g, ' ').slice(0, 300);

          this.logger.warn(
            `Terminal ${terminalId}, event ${item.eventId}: ` +
              `${item.status}; ${message}`,
          );
        }
      }

      processed += result.processed;
      downloaded += result.downloaded;
      failed += result.failed;
      missing += result.missing;

      if (result.processed < batchSize) {
        break;
      }

      // Terminal javob bermayotgan bo‘lsa (paketdagi hammasi xato) to‘xtaymiz.
      // Alohida rasm topilmasa (eski event), qolganlarini davom ettiramiz.
      if (result.failed > 0 && result.failed >= result.processed) {
        break;
      }
    }

    if (processed > 0) {
      this.logger.log(
        `Terminal ${terminalId}: ` +
          `ishlandi=${processed}, ` +
          `yuklandi=${downloaded}, ` +
          `xato=${failed}, ` +
          `rasmsiz=${missing}`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AttendancePhotoJob> | undefined, error: Error): void {
    this.logger.warn(
      `Terminal ${job?.data.terminalId ?? '?'}: ${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(): void {
    this.logger.error(
      'Rasm navbatida ulanish xatosi. Redis holatini tekshiring.',
    );
  }
}
