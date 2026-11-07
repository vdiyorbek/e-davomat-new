import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { Repository } from 'typeorm';

import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';

import {
  parseRetentionDays,
  retentionCutoff,
  safeAttendancePhotoPath,
} from './photo-retention.rules';

const BATCH_SIZE = 500;
const MAX_PER_RUN = 20_000;

@Injectable()
export class AttendancePhotoRetentionService {
  private readonly logger = new Logger(AttendancePhotoRetentionService.name);

  private running = false;

  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventsRepository: Repository<AttendanceEvent>,
  ) {}

  @Cron('0 30 3 * * *', { timeZone: 'Asia/Tashkent' })
  async scheduledRun(): Promise<void> {
    await this.run();
  }

  async run(now: Date = new Date()): Promise<{ removed: number }> {
    if (this.running) return { removed: 0 };

    const days = parseRetentionDays(
      process.env.ATTENDANCE_PHOTO_RETENTION_DAYS,
    );

    if (days === null) return { removed: 0 };

    this.running = true;

    try {
      const cutoff = retentionCutoff(now, days);
      let lastId = '0';
      let removed = 0;

      while (removed < MAX_PER_RUN) {
        const events = await this.eventsRepository
          .createQueryBuilder('event')
          .select(['event.id', 'event.photoPath'])
          .where('event.id > :lastId', { lastId })
          .andWhere('event.eventAt < :cutoff', { cutoff })
          .andWhere('event.photoStatus = :status', {
            status: EventPhotoStatus.DOWNLOADED,
          })
          .andWhere('event.photoPath IS NOT NULL')
          // daily_attendance dagi birinchi kirish / oxirgi chiqish rasmlariga tegilmaydi.
          .andWhere(
            `NOT EXISTS (
              SELECT 1 FROM daily_attendance da
              WHERE da.firstInEventId = event.id
            )`,
          )
          .andWhere(
            `NOT EXISTS (
              SELECT 1 FROM daily_attendance da
              WHERE da.lastOutEventId = event.id
            )`,
          )
          .orderBy('event.id', 'ASC')
          .limit(BATCH_SIZE)
          .getMany();

        if (events.length === 0) break;

        for (const event of events) {
          lastId = event.id;

          const absolute = event.photoPath
            ? safeAttendancePhotoPath(event.photoPath, process.cwd())
            : null;

          if (absolute) {
            try {
              await unlink(absolute);
            } catch (error: unknown) {
              const code =
                error instanceof Error && 'code' in error ? error.code : null;

              // Fayl allaqachon yo'q bo'lsa ham yozuvni tozalaymiz.
              if (code !== 'ENOENT') {
                this.logger.warn(`Rasm o'chmadi: event ${event.id}`);
                continue;
              }
            }
          }

          await this.eventsRepository.update(event.id, {
            photoPath: null,
            photoStatus: EventPhotoStatus.MISSING,
          });

          removed += 1;
        }
      }

      if (removed > 0) {
        this.logger.log(`${removed} ta eski davomat rasmi tozalandi`);
      }

      return { removed };
    } catch {
      this.logger.error('Eski rasmlarni tozalab bo‘lmadi');
      return { removed: 0 };
    } finally {
      this.running = false;
    }
  }
}
