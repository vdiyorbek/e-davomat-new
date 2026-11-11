import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSyncTerminalLockService } from '../attendance-events/event-sync-terminal-lock.service';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';
import { RedisService } from '../../redis/redis.service';

const MAX_SYNC_WINDOWS = 24;
const MAX_SYNC_RUN_MS = 90_000;

/**
 * Yangi event bo‘lmasa ham maktab davomati kamida shu oraliqda
 * bir marta qayta hisoblanadi (xavfsizlik uchun).
 */
const SAFETY_REBUILD_SECONDS = 10 * 60;

/** Event yozilgan, lekin hali hisoblanmagan maktab/sana belgisi. */
const PENDING_TTL_SECONDS = 2 * 24 * 60 * 60;

export interface TerminalSyncRunSummary {
  windows: number;
  fetched: number;
  inserted: number;
  duplicates: number;
  rebuilt: number;
  rebuildSkipped: number;
}

@Injectable()
export class TerminalSyncService {
  private readonly logger = new Logger(TerminalSyncService.name);

  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly eventSyncLock: EventSyncTerminalLockService,
    private readonly attendanceEventsService: AttendanceEventsService,
    private readonly dailyAttendanceService: DailyAttendanceService,
    private readonly redisService: RedisService,
  ) {}

  private pendingKey(schoolId: number, date: string): string {
    return `edav:attendance:rebuild-pending:${schoolId}:${date}`;
  }

  private freshKey(schoolId: number, date: string): string {
    return `edav:attendance:rebuild-fresh:${schoolId}:${date}`;
  }

  /**
   * Maktab/sana uchun kunlik davomatni qayta hisoblash kerakmi?
   *
   * Avval har 5 soniyada, yangi event bo‘lmasa ham, butun maktab
   * davomati qayta hisoblanar edi (maktab qatori FOR UPDATE bilan
   * qulflanadi). Endi:
   *  • yangi event yozilgan bo‘lsa — ha;
   *  • oldingi hisoblash yakunlanmagan bo‘lsa (pending belgisi) — ha;
   *  • so‘nggi 10 daqiqada hisoblanmagan bo‘lsa — ha (xavfsizlik);
   *  • aks holda — yo‘q.
   * Redis ishlamasa, xavfsiz tomonga: qayta hisoblaymiz.
   */
  private async needsRebuild(
    schoolId: number,
    date: string,
    inserted: number,
  ): Promise<boolean> {
    if (inserted > 0) return true;

    try {
      const redis = this.redisService.getClient();

      if ((await redis.exists(this.pendingKey(schoolId, date))) === 1) {
        return true;
      }

      // NX: kalit yo‘q bo‘lsa (10 daqiqada hisoblanmagan) — hisoblaymiz.
      const claimed = await redis.set(
        this.freshKey(schoolId, date),
        '1',
        'EX',
        SAFETY_REBUILD_SECONDS,
        'NX',
      );

      return claimed === 'OK';
    } catch {
      return true;
    }
  }

  private async markPending(schoolId: number, dates: string[]) {
    try {
      const redis = this.redisService.getClient();
      const pipeline = redis.pipeline();

      for (const date of dates) {
        pipeline.set(
          this.pendingKey(schoolId, date),
          '1',
          'EX',
          PENDING_TTL_SECONDS,
        );
      }

      await pipeline.exec();
    } catch {
      // Belgi qo‘yilmasa ham 10 daqiqalik xavfsizlik hisoblashi ishlaydi.
    }
  }

  private async markRebuilt(schoolId: number, date: string) {
    try {
      await this.redisService
        .getClient()
        .multi()
        .del(this.pendingKey(schoolId, date))
        .set(this.freshKey(schoolId, date), '1', 'EX', SAFETY_REBUILD_SECONDS)
        .exec();
    } catch {
      // Keyingi siklda qayta hisoblanadi — bu xavfsiz.
    }
  }

  async run(terminalId: number): Promise<TerminalSyncRunSummary> {
    const summary: TerminalSyncRunSummary = {
      windows: 0,
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      rebuilt: 0,
      rebuildSkipped: 0,
    };

    if (
      !Number.isInteger(terminalId) ||
      terminalId < 1 ||
      terminalId > 4294967295
    ) {
      throw new Error('Navbatdagi terminal identifikatori noto‘g‘ri');
    }
    const syncStartedAt = Date.now();
    const lease = await this.eventSyncLock.acquire(terminalId, 'run');
    try {
      await lease.assertOwned();
      // Yangi event terminal jurnaliga yozilishi uchun ozgina vaqt qoldiramiz.
      const targetMs = Date.now() - 30_000;

      // Shu run() davomida muvaffaqiyatli hisoblangan
      // maktab va sanalarni eslab turamiz.
      const rebuiltDates = new Set<string>();

      let rebuiltCount = 0;
      let skippedRebuildCount = 0;

      for (let windowIndex = 0; windowIndex < MAX_SYNC_WINDOWS; windowIndex++) {
        // Uzoq davom etadigan vazifani xavfsiz chegaralaymiz.
        // Bajarilayotgan oraliqni yarim yo'lda to'xtatmaymiz.
        if (Date.now() - syncStartedAt >= MAX_SYNC_RUN_MS) {
          this.logger.warn(
            `Terminal ${terminalId}: vaqt chegarasiga yetildi. ` +
              `Qolgan eventlar keyingi navbatda olinadi.`,
          );

          break;
        }

        await lease.assertOwned();
        const terminal = await this.terminalsRepository.findOneBy({
          id: terminalId,
        });

        if (!terminal || !terminal.isActive || !terminal.syncStartAt) {
          return summary;
        }

        const initialMs = terminal.syncStartAt.getTime();

        const cursorMs = terminal.eventsSyncedUntil?.getTime() ?? initialMs;

        if (cursorMs >= targetMs) {
          return summary;
        }

        // Oldingi chegaradan 2 daqiqa orqaga qaytib tekshiramiz.
        // Takroriy eventlarni bazadagi unique indeks ajratadi.
        const startMs = Math.max(initialMs, cursorMs - 2 * 60 * 1000);

        const endMs = Math.min(cursorMs + 60 * 60 * 1000, targetMs);

        const startAt = new Date(startMs);
        const endAt = new Date(endMs);

        const eventsStartedAt = Date.now();

        const result = await this.attendanceEventsService.sync({
          terminalId,
          startTime: this.toTerminalTime(startAt),
          endTime: this.toTerminalTime(endAt),
        });

        const eventsDurationMs = Date.now() - eventsStartedAt;

        summary.windows++;
        summary.fetched += result.fetched;
        summary.inserted += result.inserted;
        summary.duplicates += result.duplicates;

        const rebuildStartedAt = Date.now();

        // Vaqt oralig'i ikki Toshkent sanasiga tushsa,
        // ikkala sanani alohida ko'rib chiqamiz.
        const dates = this.getTashkentDates(startAt, endAt);

        // Yangi event yozildi: hisoblash tugaguncha «pending» belgisi
        // turadi. Rebuild xato bilan tugasa ham, keyingi siklda
        // (yangi event bo‘lmasa ham) albatta qayta hisoblanadi.
        if (result.inserted > 0) {
          await this.markPending(terminal.schoolId, dates);
        }

        for (const date of dates) {
          const rebuildKey = `${terminal.schoolId}:${date}`;

          // Shu run() ichida allaqachon hisoblangan va yangi event yo‘q.
          if (result.inserted === 0 && rebuiltDates.has(rebuildKey)) {
            skippedRebuildCount++;
            continue;
          }

          if (
            !(await this.needsRebuild(terminal.schoolId, date, result.inserted))
          ) {
            skippedRebuildCount++;
            continue;
          }

          await this.dailyAttendanceService.rebuild({
            schoolId: terminal.schoolId,
            date,
          });

          // Faqat rebuild muvaffaqiyatli tugagandan
          // keyin hisoblangan deb belgilaymiz.
          await this.markRebuilt(terminal.schoolId, date);
          rebuiltDates.add(rebuildKey);
          rebuiltCount++;
        }

        summary.rebuilt = rebuiltCount;
        summary.rebuildSkipped = skippedRebuildCount;

        // Eventlar va kunlik hisob muvaffaqiyatli tugagandan keyingina
        // davom etish vaqtini yangilaymiz.
        const update = this.terminalsRepository
          .createQueryBuilder()
          .update(Terminal)
          .set({
            eventsSyncedUntil: endAt,
            lastSuccessfulSyncAt: new Date(),
          })
          .where('id = :id', { id: terminalId })
          .andWhere('isActive = :active', { active: true })
          .andWhere('syncStartAt = :initialStart', {
            initialStart: terminal.syncStartAt,
          });
        await lease.assertOwned();

        if (terminal.eventsSyncedUntil) {
          update.andWhere('eventsSyncedUntil = :previousCursor', {
            previousCursor: terminal.eventsSyncedUntil,
          });
        } else {
          update.andWhere('eventsSyncedUntil IS NULL');
        }

        const updated = await update.execute();

        if (updated.affected !== 1) {
          throw new Error(
            'Terminal holati yoki sinxronlash chegarasi o‘zgardi. Vazifa qayta tekshiriladi',
          );
        }

        const rebuildDurationMs = Date.now() - rebuildStartedAt;

        // Yangi event bo‘lmagan oddiy sikllarni log’ga yozmaymiz —
        // har 5 soniyada har terminal uchun 2 qator log to‘planib qolardi.
        if (result.inserted === 0 && rebuiltCount === 0) {
          continue;
        }

        this.logger.log(
          `Terminal ${terminalId}: ` +
            `eventsMs=${eventsDurationMs}, ` +
            `rebuildMs=${rebuildDurationMs}, ` +
            `totalMs=${Date.now() - syncStartedAt}`,
        );

        this.logger.log(
          `Terminal ${terminalId}: ` +
            `${startAt.toISOString()} → ${endAt.toISOString()}; ` +
            `olindi=${result.fetched}, ` +
            `yangi=${result.inserted}, ` +
            `takror=${result.duplicates}, ` +
            `rebuild=${rebuiltCount}, ` +
            `rebuildSkipped=${skippedRebuildCount}`,
        );

        if (
          result.skippedInvalidPnfl > 0 ||
          result.skippedOtherEvents > 0 ||
          result.skippedInvalidFormat > 0 ||
          result.skippedOutOfRange > 0
        ) {
          this.logger.warn(
            `Terminal ${terminalId}: ` +
              `yaroqsiz PNFL=${result.skippedInvalidPnfl}, ` +
              `boshqa event=${result.skippedOtherEvents}, ` +
              `buzuq format=${result.skippedInvalidFormat}, ` +
              `oraliqdan tashqari=${result.skippedOutOfRange}`,
          );
        }
      }
      return summary;
    } finally {
      // Muvaffaqiyat yoki xatolikdan qat'i nazar
      // o'zimizga tegishli Redis Lock'ni bo'shatamiz.
      await lease.release();
    }
  }

  private getTashkentDates(startAt: Date, endAt: Date): string[] {
    const offsetMs = 5 * 60 * 60 * 1000;

    const firstDate = new Date(startAt.getTime() + offsetMs)
      .toISOString()
      .slice(0, 10);

    const lastDate = new Date(endAt.getTime() + offsetMs)
      .toISOString()
      .slice(0, 10);

    const dates: string[] = [];
    const current = new Date(`${firstDate}T00:00:00Z`);

    while (current.toISOString().slice(0, 10) <= lastDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
  private toTerminalTime(date: Date): string {
    const tashkentTime = new Date(date.getTime() + 5 * 60 * 60 * 1000);

    return `${tashkentTime.toISOString().slice(0, 19)}+05:00`;
  }
}
