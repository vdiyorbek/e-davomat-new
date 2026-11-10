import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSyncTerminalLockService } from '../attendance-events/event-sync-terminal-lock.service';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';

@Injectable()
export class TerminalSyncService {
  private readonly logger = new Logger(TerminalSyncService.name);

  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly eventSyncLock: EventSyncTerminalLockService,
    private readonly attendanceEventsService: AttendanceEventsService,
    private readonly dailyAttendanceService: DailyAttendanceService,
  ) {}

  async run(terminalId: number): Promise<void> {
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

      for (let windowIndex = 0; windowIndex < 6; windowIndex++) {
        const terminal = await this.terminalsRepository.findOneBy({
          id: terminalId,
        });

        if (!terminal || !terminal.isActive || !terminal.syncStartAt) {
          return;
        }

        const initialMs = terminal.syncStartAt.getTime();

        const cursorMs = terminal.eventsSyncedUntil?.getTime() ?? initialMs;

        if (cursorMs >= targetMs) {
          return;
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

        const rebuildStartedAt = Date.now();

        // Oraliq ikki Toshkent sanasiga tushsa, ikkala kun hisoblanadi.

        // Vaqt oralig'i ikki Toshkent sanasiga tushsa,
        // ikkala sanani alohida ko'rib chiqamiz.
        for (const date of this.getTashkentDates(startAt, endAt)) {
          const rebuildKey = `${terminal.schoolId}:${date}`;

          // Agar ushbu maktab va sana shu run() ichida
          // muvaffaqiyatli hisoblangan bo'lsa va
          // yangi event yozilmagan bo'lsa, takroriy
          // to'liq hisoblashni o'tkazib yuboramiz.
          const canSkipRebuild =
            result.inserted === 0 && rebuiltDates.has(rebuildKey);

          if (canSkipRebuild) {
            skippedRebuildCount++;
            continue;
          }

          // Yangi event mavjud bo'lsa yoki sana birinchi
          // marta uchrasa, to'liq hisoblaymiz.
          await this.dailyAttendanceService.rebuild({
            schoolId: terminal.schoolId,
            date,
          });

          // Faqat rebuild muvaffaqiyatli tugagandan
          // keyin hisoblangan deb belgilaymiz.
          rebuiltDates.add(rebuildKey);
          rebuiltCount++;
        }

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
