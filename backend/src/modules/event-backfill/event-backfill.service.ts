import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';
import { tashkentDate } from '../hikvision-push/hikvision-push.types';
import { Terminal } from '../terminals/terminal.entity';

const MAX_DAYS = 31;
const STATUS_TTL_SECONDS = 7 * 24 * 3600;
const LOCK_TTL_SECONDS = 6 * 3600;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface BackfillDay {
  date: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  photosQueued: number;
  error: string | null;
}

export interface BackfillStatus {
  terminalId: number;
  state: 'running' | 'done' | 'failed';
  from: string;
  to: string;
  currentDate: string | null;
  days: BackfillDay[];
  startedAt: string;
  updatedAt: string;
}

const statusKey = (terminalId: number) => `edav:backfill:${terminalId}:status`;
const lockKey = (terminalId: number) => `edav:backfill:${terminalId}:lock`;

function addDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Terminal xotirasidagi eventlarni sana oralig‘i bo‘yicha qayta olish
 * (ISAPI AcsEvent). Push navbatidan tashqari qolib ketgan kunlarni tiklash uchun.
 * Takroriy eventlar yagona indeks tufayli ikki marta yozilmaydi.
 */
@Injectable()
export class EventBackfillService {
  private readonly logger = new Logger(EventBackfillService.name);

  constructor(
    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
    private readonly events: AttendanceEventsService,
    private readonly daily: DailyAttendanceService,
    private readonly redisService: RedisService,
  ) {}

  async status(terminalId: number): Promise<BackfillStatus | null> {
    const raw = await this.redisService.getClient().get(statusKey(terminalId));
    return raw ? (JSON.parse(raw) as BackfillStatus) : null;
  }

  async start(
    terminalId: number,
    from: string,
    to: string,
  ): Promise<BackfillStatus> {
    if (!DAY.test(from) || !DAY.test(to) || from > to) {
      throw new BadRequestException('Sana oralig‘i noto‘g‘ri');
    }
    if (to > tashkentDate(new Date())) {
      throw new BadRequestException('Kelajak sanasini tanlab bo‘lmaydi');
    }
    const days: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
    if (days.length > MAX_DAYS) {
      throw new BadRequestException(
        `Bir marta ko‘pi bilan ${MAX_DAYS} kun olinadi`,
      );
    }

    const terminal = await this.terminals.findOne({
      where: { id: terminalId },
    });
    if (!terminal || terminal.archivedAt) {
      throw new NotFoundException('Terminal topilmadi');
    }
    if (!terminal.isActive) {
      throw new BadRequestException('Terminal o‘chirilgan');
    }

    const redis = this.redisService.getClient();
    const locked = await redis.set(
      lockKey(terminalId),
      '1',
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    if (locked !== 'OK') {
      throw new ConflictException(
        'Bu terminal uchun eventlarni olish allaqachon ketmoqda',
      );
    }

    const now = new Date().toISOString();
    const status: BackfillStatus = {
      terminalId,
      state: 'running',
      from,
      to,
      currentDate: days[0],
      days: [],
      startedAt: now,
      updatedAt: now,
    };
    await this.save(status);

    // Fon rejimida: HTTP so‘rovi darhol qaytadi, jarayonni status orqali kuzatiladi.
    void this.run(terminal, days, status);
    return status;
  }

  private async save(status: BackfillStatus): Promise<void> {
    status.updatedAt = new Date().toISOString();
    await this.redisService
      .getClient()
      .set(
        statusKey(status.terminalId),
        JSON.stringify(status),
        'EX',
        STATUS_TTL_SECONDS,
      );
  }

  private async run(
    terminal: Terminal,
    days: string[],
    status: BackfillStatus,
  ): Promise<void> {
    try {
      for (const date of days) {
        status.currentDate = date;
        await this.save(status);

        const result: BackfillDay = {
          date,
          fetched: 0,
          inserted: 0,
          duplicates: 0,
          photosQueued: 0,
          error: null,
        };
        try {
          const endOfDay = Date.parse(`${addDays(date, 1)}T00:00:00+05:00`);
          const stats = await this.syncDay(
            terminal.id,
            `${date}T00:00:00+05:00`,
            new Date(Math.min(endOfDay, Date.now() - 1000)).toISOString(),
          );
          result.fetched = stats.fetched;
          result.inserted = stats.inserted;
          result.duplicates = stats.duplicates;
          result.photosQueued = stats.photosQueued;

          // Kunlik davomat va dashboard qayta hisoblanadi.
          await this.daily.rebuild({ schoolId: terminal.schoolId, date });
        } catch (error: unknown) {
          result.error = (
            error instanceof Error ? error.message : 'Noma’lum xato'
          ).slice(0, 300);
          this.logger.warn(`Terminal ${terminal.id}, ${date}: ${result.error}`);
        }
        status.days.push(result);
        await this.save(status);
      }
      status.state = status.days.some((day) => day.error) ? 'failed' : 'done';
    } catch (error: unknown) {
      status.state = 'failed';
      this.logger.error(
        `Eventlarni olish to‘xtadi (terminal ${terminal.id}): ${error instanceof Error ? error.message : 'xato'}`,
      );
    } finally {
      status.currentDate = null;
      await this.save(status).catch(() => undefined);
      await this.redisService
        .getClient()
        .del(lockKey(terminal.id))
        .catch(() => undefined);
    }
  }

  /** Terminal qulfi band bo‘lsa (rasm yuklovchi), bir necha marta kutib qayta urinadi. */
  private async syncDay(
    terminalId: number,
    startTime: string,
    endTime: string,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.events.sync({ terminalId, startTime, endTime });
      } catch (error: unknown) {
        if (error instanceof ConflictException && attempt < 10) {
          await sleep(6000);
          continue;
        }
        throw error;
      }
    }
  }
}
