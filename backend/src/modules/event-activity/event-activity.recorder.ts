import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type EventActivitySource = 'PUSH' | 'AUTO_PULL' | 'MANUAL_PULL';

export interface EventActivityEntry {
  terminalId: number;
  schoolId: number;
  source: EventActivitySource;
  received: number;
  inserted: number;
  duplicates: number;
  withPicture: number;
  withoutPicture: number;
  maxLagSeconds?: number;
  /** «Olish» manbalari uchun: nechta urinish (push uchun 0). */
  runs?: number;
}

const RETENTION_DAYS = 30;
const hourStart = (): Date =>
  new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);

/**
 * Push va «olish» faoliyatini soatlik yig‘ma qilib yozadi (terminal × manba × soat).
 * Davomat yozuvini hech qachon to‘xtatmaydi: xatolik faqat logga ogohlantirish bo‘ladi.
 */
@Injectable()
export class EventActivityRecorder {
  private readonly logger = new Logger(EventActivityRecorder.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(entries: EventActivityEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const at = hourStart();
    try {
      await this.dataSource.query(
        `INSERT INTO terminal_event_activity
           (terminalId, source, hourStart, schoolId, received, inserted, duplicates,
            withPicture, withoutPicture, maxLagSeconds, runs)
         VALUES ${entries.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
         ON DUPLICATE KEY UPDATE
           received = received + VALUES(received),
           inserted = inserted + VALUES(inserted),
           duplicates = duplicates + VALUES(duplicates),
           withPicture = withPicture + VALUES(withPicture),
           withoutPicture = withoutPicture + VALUES(withoutPicture),
           maxLagSeconds = GREATEST(maxLagSeconds, VALUES(maxLagSeconds)),
           runs = runs + VALUES(runs)`,
        entries.flatMap((entry) => [
          entry.terminalId,
          entry.source,
          at,
          entry.schoolId,
          entry.received,
          entry.inserted,
          entry.duplicates,
          entry.withPicture,
          entry.withoutPicture,
          Math.max(0, Math.round(entry.maxLagSeconds ?? 0)),
          entry.runs ?? 0,
        ]),
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Faoliyat yig‘masi yozilmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    }
  }

  /** Har kecha: 30 kundan eski yig‘malar o‘chiriladi. */
  @Cron('0 10 3 * * *', { timeZone: 'Asia/Tashkent' })
  async cleanup(): Promise<void> {
    try {
      await this.dataSource.query(
        'DELETE FROM terminal_event_activity WHERE hourStart < ?',
        [new Date(Date.now() - RETENTION_DAYS * 24 * 3_600_000)],
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Eski faoliyat yig‘malarini o‘chirib bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    }
  }
}
