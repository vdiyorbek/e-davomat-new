import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventSyncTerminalLockService } from './event-sync-terminal-lock.service';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, QueryFailedError, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { Terminal } from '../terminals/terminal.entity';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import { HikvisionEventsService } from '../terminals/hikvision-events.service';

import { AttendanceEvent } from './attendance-event.entity';
import { EventPhotoStatus } from './enums/event-photo-status.enum';
import { SyncAttendanceEventsDto } from './dto/sync-attendance-events.dto';

interface SyncStatistics {
  fetched: number;
  inserted: number;
  duplicates: number;
  skippedOtherEvents: number;
  skippedInvalidPnfl: number;
  skippedInvalidFormat: number;
  skippedOutOfRange: number;
  photosQueued: number;
}

/** Bitta INSERT / SELECT IN so‘rovidagi qatorlar soni. */
const INSERT_CHUNK = 500;

@Injectable()
export class AttendanceEventsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly terminalCrypto: TerminalCryptoService,
    private readonly hikvisionEvents: HikvisionEventsService,

    private readonly eventSyncLock: EventSyncTerminalLockService,
  ) {}

  async sync(dto: SyncAttendanceEventsDto) {
    const startMs = Date.parse(dto.startTime);
    const endMs = Date.parse(dto.endTime);

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      startMs >= endMs
    ) {
      throw new BadRequestException('Vaqt oralig‘i noto‘g‘ri');
    }

    if (endMs - startMs > 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Bitta so‘rovdagi vaqt oralig‘i 24 soatdan oshmasligi kerak',
      );
    }

    if (endMs > Date.now()) {
      throw new BadRequestException(
        'Tugash vaqti kelajakda bo‘lishi mumkin emas',
      );
    }

    const lease = await this.eventSyncLock.acquire(dto.terminalId);

    try {
      const terminal = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .addSelect('terminal.passwordEncrypted')
        .where('terminal.id = :id', { id: dto.terminalId })
        .getOne();

      if (!terminal) {
        throw new NotFoundException('Terminal topilmadi');
      }

      if (!terminal.isActive) {
        throw new BadRequestException(
          'Terminal o‘chirilgan. Avval uni faollashtiring',
        );
      }

      let password: string;

      try {
        password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);
      } catch {
        throw new InternalServerErrorException(
          'Terminal parolini ochib bo‘lmadi. Shifrlash kalitini tekshiring',
        );
      }

      const statistics: SyncStatistics = {
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        skippedOtherEvents: 0,
        skippedInvalidPnfl: 0,
        skippedInvalidFormat: 0,
        skippedOutOfRange: 0,
        photosQueued: 0,
      };

      try {
        for await (const {
          events,
          invalidCount,
        } of this.hikvisionEvents.readEvents(
          terminal,
          password,
          dto.startTime,
          dto.endTime,
        )) {
          // Har bir sahifa alohida tranzaksiyada saqlanadi.
          await lease.assertOwned();

          // Har bir sahifa alohida tranzaksiyada saqlanadi.
          const pageStatistics = await this.dataSource.transaction(
            async (manager): Promise<SyncStatistics> => {
              const repository = manager.getRepository(AttendanceEvent);

              const counts: SyncStatistics = {
                fetched: events.length + invalidCount,
                inserted: 0,
                duplicates: 0,
                skippedOtherEvents: 0,
                skippedInvalidPnfl: 0,
                skippedInvalidFormat: invalidCount,
                skippedOutOfRange: 0,
                photosQueued: 0,
              };

              // 1) Saqlanadigan eventlarni ajratamiz.
              const rows: Array<QueryDeepPartialEntity<AttendanceEvent>> = [];

              for (const event of events) {
                if (
                  event.major !== 5 ||
                  event.minor !== 75 ||
                  event.currentVerifyMode !== 'face'
                ) {
                  counts.skippedOtherEvents++;
                  continue;
                }

                const pnfl = event.employeeNoString;

                if (typeof pnfl !== 'string' || !/^\d{14}$/.test(pnfl)) {
                  counts.skippedInvalidPnfl++;
                  continue;
                }

                const eventAt = new Date(event.time);
                const eventMs = eventAt.getTime();

                // MySQL DATETIME chegarasi va qidiruv oralig‘i.
                // Bunday eventni saqlamaymiz, lekin sinxronlashni ham
                // to‘xtatmaymiz: aks holda kursor shu oynada qotib qoladi.
                if (
                  eventAt.getUTCFullYear() < 1000 ||
                  eventAt.getUTCFullYear() > 9999 ||
                  eventMs < startMs ||
                  eventMs > endMs
                ) {
                  counts.skippedOutOfRange++;
                  continue;
                }

                const pictureUrl = event.pictureURL?.trim() || null;

                rows.push({
                  terminalId: terminal.id,
                  schoolId: terminal.schoolId,
                  pnfl,
                  serialNo: BigInt(event.serialNo).toString(),
                  eventAt,
                  direction: terminal.direction,
                  major: event.major,
                  minor: event.minor,
                  verifyMode: event.currentVerifyMode,
                  sourcePictureUrl: pictureUrl,
                  photoPath: null,
                  photoStatus: pictureUrl
                    ? EventPhotoStatus.PENDING
                    : EventPhotoStatus.MISSING,
                  photoAttempts: 0,
                  photoLastAttemptAt: null,
                });
              }

              // 2) Bazada allaqachon borlarini bitta so‘rov bilan aniqlaymiz.
              // Sinxronlash har safar 2 daqiqa orqadan boshlangani uchun
              // takroriy eventlar ko‘p bo‘ladi; avval har biri alohida
              // INSERT + ER_DUP_ENTRY xatosi bilan qaytardi.
              const fresh = await this.excludeExisting(
                repository,
                terminal.id,
                rows,
              );

              counts.duplicates += rows.length - fresh.length;

              // 3) Yangilarini bo‘laklab, bitta INSERT bilan yozamiz.
              for (let index = 0; index < fresh.length; index += INSERT_CHUNK) {
                const chunk = fresh.slice(index, index + INSERT_CHUNK);
                const inserted = await this.insertChunk(repository, chunk);

                counts.inserted += inserted.inserted;
                counts.duplicates += inserted.duplicates;
                counts.photosQueued += chunk.filter(
                  (row, rowIndex) =>
                    inserted.insertedIndexes.has(rowIndex) &&
                    Boolean(row.sourcePictureUrl),
                ).length;
              }
              await lease.assertOwned();
              return counts;
            },
          );

          // Hisoblagichlar faqat tranzaksiya saqlangandan keyin oshadi.
          statistics.fetched += pageStatistics.fetched;
          statistics.inserted += pageStatistics.inserted;
          statistics.duplicates += pageStatistics.duplicates;
          statistics.skippedOtherEvents += pageStatistics.skippedOtherEvents;
          statistics.skippedInvalidPnfl += pageStatistics.skippedInvalidPnfl;
          statistics.skippedInvalidFormat +=
            pageStatistics.skippedInvalidFormat;
          statistics.skippedOutOfRange += pageStatistics.skippedOutOfRange;
          statistics.photosQueued += pageStatistics.photosQueued;
        }
      } catch (error: unknown) {
        if (error instanceof QueryFailedError) {
          throw new InternalServerErrorException(
            'Eventlarni bazaga saqlashda xatolik yuz berdi',
          );
        }

        throw new BadGatewayException(
          error instanceof Error
            ? error.message
            : 'Terminaldan eventlarni olib bo‘lmadi',
        );
      }
      await lease.assertOwned();
      return {
        success: true,
        terminalId: terminal.id,
        startTime: dto.startTime,
        endTime: dto.endTime,
        completedAt: new Date(),
        ...statistics,
      };
    } finally {
      await lease.release();
    }
  }

  /** Bazada mavjud (terminalId, serialNo, eventAt) yozuvlarini chiqarib tashlaydi. */
  private async excludeExisting(
    repository: Repository<AttendanceEvent>,
    terminalId: number,
    rows: Array<QueryDeepPartialEntity<AttendanceEvent>>,
  ): Promise<Array<QueryDeepPartialEntity<AttendanceEvent>>> {
    if (rows.length === 0) return rows;

    const keyOf = (serialNo: string, eventAt: Date) =>
      `${serialNo}|${eventAt.getTime()}`;

    const existing = new Set<string>();
    const serials = [...new Set(rows.map((row) => String(row.serialNo)))];

    for (let index = 0; index < serials.length; index += INSERT_CHUNK) {
      const found = await repository
        .createQueryBuilder('event')
        .select(['event.serialNo', 'event.eventAt'])
        .where('event.terminalId = :terminalId', { terminalId })
        .andWhere('event.serialNo IN (:...serials)', {
          serials: serials.slice(index, index + INSERT_CHUNK),
        })
        .getMany();

      for (const event of found) {
        existing.add(keyOf(String(event.serialNo), new Date(event.eventAt)));
      }
    }

    // Bitta sahifa ichidagi takrorlarni ham olib tashlaymiz.
    const seen = new Set<string>();

    return rows.filter((row) => {
      const key = keyOf(String(row.serialNo), row.eventAt as Date);
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Bo‘lakni bitta INSERT bilan yozadi. Kamdan-kam holatda (parallel
   * yozuv) unique xatosi chiqsa, shu bo‘lakni bittalab yozishga o‘tadi.
   */
  private async insertChunk(
    repository: Repository<AttendanceEvent>,
    chunk: Array<QueryDeepPartialEntity<AttendanceEvent>>,
  ): Promise<{
    inserted: number;
    duplicates: number;
    insertedIndexes: Set<number>;
  }> {
    const all = new Set(chunk.map((_, index) => index));

    if (chunk.length === 0) {
      return { inserted: 0, duplicates: 0, insertedIndexes: all };
    }

    try {
      await repository.insert(chunk);
      return { inserted: chunk.length, duplicates: 0, insertedIndexes: all };
    } catch (error: unknown) {
      if (!this.isDuplicate(error)) throw error;
    }

    const insertedIndexes = new Set<number>();
    let duplicates = 0;

    for (const [index, row] of chunk.entries()) {
      try {
        await repository.insert(row);
        insertedIndexes.add(index);
      } catch (error: unknown) {
        if (!this.isDuplicate(error)) throw error;
        duplicates++;
      }
    }

    return { inserted: insertedIndexes.size, duplicates, insertedIndexes };
  }

  private isDuplicate(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        'ER_DUP_ENTRY'
    );
  }
}
