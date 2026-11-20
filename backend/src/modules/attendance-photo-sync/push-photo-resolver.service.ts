import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import {
  EventSyncTerminalLockService,
  type EventSyncLease,
} from '../attendance-events/event-sync-terminal-lock.service';
import { SettingsService } from '../system-settings/settings.service';
import { HikvisionEventsService } from '../terminals/hikvision-events.service';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import { Terminal } from '../terminals/terminal.entity';
import { TerminalEventSource } from '../terminals/enums/terminal-event-source.enum';

/** Bir terminal uchun bir aylanishda ko‘rib chiqiladigan eventlar. */
const BATCH = 200;
/** Bir qidiruvdagi serial oralig‘i (oradagi boshqa eventlar ham bor). */
const SERIAL_SPAN = 3000;
/** Rasm havolasi topilmasa — shuncha urinishdan keyin to‘xtatiladi. */
const MAX_LOOKUPS = 3;
const NOT_FOUND = 'Push eventida rasm yo‘q, terminal xotirasida ham topilmadi';

export function toTerminalTime(date: Date): string {
  const tashkent = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return `${tashkent.toISOString().slice(0, 19)}+05:00`;
}

/**
 * Ayrim Hikvision terminallari (ayniqsa xotiradagi eski eventlarni qayta
 * yuborganda) HTTP push'da rasm ham, pictureURL ham yubormaydi. Terminal
 * serverdan ko‘rinadigan bo‘lsa, shu eventning pictureURL'i ISAPI AcsEvent
 * qidiruvidan serialNo bo‘yicha olinadi va oddiy rasm yuklash navbatiga
 * (PENDING) qo‘yiladi.
 */
@Injectable()
export class PushPhotoResolverService {
  private readonly logger = new Logger(PushPhotoResolverService.name);
  private running = false;

  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventsRepository: Repository<AttendanceEvent>,
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly hikvisionEvents: HikvisionEventsService,
    private readonly terminalCrypto: TerminalCryptoService,
    private readonly lock: EventSyncTerminalLockService,
    private readonly settings: SettingsService,
  ) {}

  private enabled(): boolean {
    return this.settings.getBool('pushPhotoLookup');
  }

  // Har daqiqaning 40-soniyasida (rasm yuklovchi 15-soniyada ishlaydi).
  @Cron('40 * * * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      const terminals = await this.candidates();
      for (const terminalId of terminals) {
        await this.resolveTerminal(terminalId).catch((error: unknown) => {
          this.logger.warn(
            `Terminal ${terminalId}: rasm havolasini olib bo‘lmadi — ${error instanceof Error ? error.message : 'noma’lum xato'}`,
          );
        });
      }
    } catch {
      this.logger.error('Push rasm qidiruvini boshlab bo‘lmadi (MySQL?)');
    } finally {
      this.running = false;
    }
  }

  private baseQuery() {
    const days = this.settings.getInt('pushPhotoLookupDays');
    const retryBefore = new Date(Date.now() - 10 * 60_000);
    return this.eventsRepository
      .createQueryBuilder('event')
      .innerJoin(Terminal, 'terminal', 'terminal.id = event.terminalId')
      .where('terminal.isActive = 1')
      .andWhere('terminal.eventSource = :push', {
        push: TerminalEventSource.PUSH,
      })
      .andWhere('event.photoStatus = :missing', {
        missing: EventPhotoStatus.MISSING,
      })
      .andWhere('event.sourcePictureUrl IS NULL')
      .andWhere('event.photoPath IS NULL')
      .andWhere('event.photoAttempts < :max', { max: MAX_LOOKUPS })
      .andWhere('event.eventAt >= :since', {
        since: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      })
      .andWhere(
        '(event.photoLastAttemptAt IS NULL OR event.photoLastAttemptAt <= :retryBefore)',
        { retryBefore },
      );
  }

  private async candidates(): Promise<number[]> {
    const rows = await this.baseQuery()
      .select('DISTINCT event.terminalId', 'terminalId')
      .getRawMany<{ terminalId: number | string }>();
    return rows.map((row) => Number(row.terminalId));
  }

  async resolveTerminal(
    terminalId: number,
  ): Promise<{ found: number; notFound: number }> {
    let lease: EventSyncLease;
    try {
      lease = await this.lock.acquire(terminalId, 'photos');
    } catch {
      return { found: 0, notFound: 0 }; // Rasm yuklovchi band — keyingi safar.
    }

    try {
      const events = await this.baseQuery()
        .select(['event.id', 'event.serialNo', 'event.eventAt'])
        .andWhere('event.terminalId = :terminalId', { terminalId })
        // Eng yangi eventlardan boshlanadi: ularning rasmi terminalda saqlangan.
        // Eski eventlarning rasmi ko‘pincha o‘chib ketgan va keyin navbat oladi.
        .orderBy('event.serialNo', 'DESC')
        .take(BATCH)
        .getMany();
      if (events.length === 0) return { found: 0, notFound: 0 };

      // Serial oralig‘i bo‘yicha qidiruv: vaqt va soat mintaqasiga bog‘liq emas.
      // Oraliq juda keng bo‘lmasin — qolganlari keyingi aylanishda.
      const end = Number(events[0].serialNo);
      const batch = events.filter(
        (e) => end - Number(e.serialNo) <= SERIAL_SPAN,
      );
      const begin = Number(batch[batch.length - 1].serialNo);

      const terminal = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .addSelect('terminal.passwordEncrypted')
        .where('terminal.id = :terminalId', { terminalId })
        .getOne();
      if (!terminal) return { found: 0, notFound: 0 };

      const wanted = new Map(batch.map((e) => [String(e.serialNo), e]));
      const urls = new Map<string, string>();
      // Diagnostika: terminal nechta event qaytardi, nechtasi serial bo‘yicha mos keldi.
      let returned = 0;
      let matched = 0;
      let sample = '';

      try {
        const password = this.terminalCrypto.decrypt(
          terminal.passwordEncrypted,
        );
        for await (const page of this.hikvisionEvents.readEventsBySerial(
          terminal,
          password,
          begin,
          end,
        )) {
          await lease.assertOwned();
          for (const event of page.events) {
            const serial = String(event.serialNo);
            returned++;
            if (!sample) sample = `${serial} @ ${event.time}`;
            if (wanted.has(serial)) matched++;
            if (wanted.has(serial) && event.pictureURL?.trim()) {
              urls.set(serial, event.pictureURL.trim().slice(0, 2000));
            }
          }
          if (urls.size === wanted.size) break;
        }
      } catch (error: unknown) {
        // Terminal ko‘rinmasa — urinish hisoblanadi, 10 daqiqadan keyin qayta.
        await this.markAttempt(
          batch.map((e) => e.id),
          `Terminaldan rasm havolasini so‘rab bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`.slice(
            0,
            500,
          ),
        );
        throw error;
      }

      for (const [serial, url] of urls) {
        await this.eventsRepository.update(wanted.get(serial)!.id, {
          sourcePictureUrl: url,
          photoStatus: EventPhotoStatus.PENDING,
          photoAttempts: 0,
          photoLastAttemptAt: null,
          photoLastError: null,
        });
      }
      const missing = batch
        .filter((e) => !urls.has(String(e.serialNo)))
        .map((e) => e.id);
      await this.markAttempt(missing, NOT_FOUND);

      if (urls.size > 0 || missing.length > 0) {
        this.logger.log(
          `Terminal ${terminalId}: ${urls.size} ta push event uchun rasm havolasi topildi, ${missing.length} tasida yo‘q ` +
            `(serial ${begin}…${end}, vaqt ${toTerminalTime(batch[0].eventAt)}: ` +
            `terminal ${returned} ta event qaytardi, serial mos kelgani ${matched}; ` +
            `terminalda birinchisi ${sample || '—'})`,
        );
      }
      return { found: urls.size, notFound: missing.length };
    } finally {
      await lease.release();
    }
  }

  private async markAttempt(ids: string[], message: string): Promise<void> {
    if (ids.length === 0) return;
    await this.eventsRepository.update(
      { id: In(ids) },
      {
        photoAttempts: () => '`photoAttempts` + 1',
        photoLastAttemptAt: new Date(),
        photoLastError: message,
      },
    );
  }
}
