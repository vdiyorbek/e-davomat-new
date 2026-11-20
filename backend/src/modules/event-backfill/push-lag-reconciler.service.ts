import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { SettingsService } from '../system-settings/settings.service';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';
import { PUSH_LAG_KEY_PREFIX } from '../hikvision-push/hikvision-push.types';
import { EventActivityRecorder } from '../event-activity/event-activity.recorder';
import { tashkentDate } from '../hikvision-push/hikvision-push.types';
import { TerminalEventSource } from '../terminals/enums/terminal-event-source.enum';
import { Terminal } from '../terminals/terminal.entity';

const POINTER_PREFIX = 'edav:push:reconciled:';
const POINTER_TTL_SECONDS = 3 * 24 * 3600;
/** Bir ISAPI qidiruvi 24 soatdan oshmasligi kerak. */
const MAX_WINDOW_MS = 23 * 60 * 60 * 1000;
/** Oldingi oraliq bilan ozgina ustma-ust tushadi: chekka eventlar tushib qolmasin. */
const OVERLAP_MS = 2 * 60 * 1000;
const MAX_TERMINALS_PER_RUN = 40;
const CONCURRENCY = 3;

const addDays = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

/**
 * Push navbatda kechikayotgan (xotiradagi eski eventlarni yuborayotgan) terminalning
 * bugungi eventlarini ISAPI orqali o‘zi olib turadi. Push yetib kelgach, takror
 * eventlar yagona indeks tufayli qayta yozilmaydi. Kechikmayotgan terminallarga tegmaydi.
 */
@Injectable()
export class PushLagReconcilerService {
  private readonly logger = new Logger(PushLagReconcilerService.name);
  private running = false;
  private readonly warnedAt = new Map<number, number>();

  constructor(
    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
    private readonly events: AttendanceEventsService,
    private readonly daily: DailyAttendanceService,
    private readonly redisService: RedisService,
    private readonly settings: SettingsService,
    private readonly activity: EventActivityRecorder,
  ) {}

  // Har 2 daqiqada.
  @Cron('20 */2 * * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (!this.settings.getBool('pushLagReconcile') || this.running) return;
    this.running = true;
    try {
      const ids = await this.laggingTerminalIds();
      if (ids.length === 0) return;

      const terminals = await this.terminals.find({
        where: {
          id: In(ids),
          isActive: true,
          eventSource: TerminalEventSource.PUSH,
        },
      });
      const queue = terminals
        .filter((terminal) => !terminal.archivedAt)
        .slice(0, MAX_TERMINALS_PER_RUN);

      let cursor = 0;
      const worker = async () => {
        while (cursor < queue.length) {
          const terminal = queue[cursor++];
          await this.reconcile(terminal).catch((error: unknown) =>
            this.warn(terminal.id, error),
          );
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } catch (error: unknown) {
      this.logger.error(
        `Kechikishni tekshirib bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async laggingTerminalIds(): Promise<number[]> {
    const redis = this.redisService.getClient();
    const ids: number[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${PUSH_LAG_KEY_PREFIX}*`,
        'COUNT',
        500,
      );
      cursor = next;
      for (const key of keys) {
        const id = Number(key.slice(PUSH_LAG_KEY_PREFIX.length));
        if (Number.isSafeInteger(id) && id > 0) ids.push(id);
      }
    } while (cursor !== '0' && ids.length < 5000);
    return ids;
  }

  private async reconcile(terminal: Terminal): Promise<void> {
    const redis = this.redisService.getClient();
    const pointerKey = `${POINTER_PREFIX}${terminal.id}`;

    const todayStart = Date.parse(`${tashkentDate(new Date())}T00:00:00+05:00`);
    const saved = Number(await redis.get(pointerKey));
    // Birinchi marta — bugun 00:00 dan; keyin oxirgi muvaffaqiyatli nuqtadan.
    const start =
      Number.isFinite(saved) && saved > 0
        ? Math.max(saved - OVERLAP_MS, todayStart - 24 * 3600 * 1000)
        : todayStart;
    const end = Math.min(start + MAX_WINDOW_MS, Date.now() - 1000);
    if (end <= start) return;

    let stats: Awaited<ReturnType<AttendanceEventsService['sync']>>;
    try {
      stats = await this.events.sync({
        terminalId: terminal.id,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
      });
    } catch (error: unknown) {
      // Qo‘lda olish yoki boshqa sinxronlash ketmoqda — keyingi safar.
      if (error instanceof ConflictException) return;
      throw error;
    }

    // Faoliyat tarixiga (sinxronlash tarixi → Push) yozamiz; bo‘sh urinishlar shovqin qilmasin.
    if (stats.fetched > 0) {
      await this.activity.record([
        {
          terminalId: terminal.id,
          schoolId: terminal.schoolId,
          source: 'AUTO_PULL',
          received: stats.fetched,
          inserted: stats.inserted,
          duplicates: stats.duplicates,
          withPicture: stats.photosQueued,
          withoutPicture: Math.max(0, stats.inserted - stats.photosQueued),
          runs: 1,
        },
      ]);
    }

    // Kunlik davomat va dashboard: oraliqdagi kunlar qayta hisoblanadi.
    if (stats.inserted > 0) {
      const first = tashkentDate(new Date(start));
      const last = tashkentDate(new Date(end));
      for (let day = first; day <= last; day = addDays(day, 1)) {
        await this.daily.rebuild({ schoolId: terminal.schoolId, date: day });
      }
      this.logger.log(
        `Terminal ${terminal.id}: push kechikmoqda — terminaldan ${stats.inserted} ta yangi event olindi (${stats.fetched} tadan)`,
      );
    }

    await redis.set(pointerKey, String(end), 'EX', POINTER_TTL_SECONDS);
  }

  private warn(terminalId: number, error: unknown): void {
    const last = this.warnedAt.get(terminalId) ?? 0;
    if (Date.now() - last < 10 * 60 * 1000) return;
    this.warnedAt.set(terminalId, Date.now());
    this.logger.warn(
      `Terminal ${terminalId}: kechikkan eventlarni olib bo‘lmadi — ${error instanceof Error ? error.message : 'xato'}`,
    );
  }
}
