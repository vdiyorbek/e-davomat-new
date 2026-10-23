import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, QueryFailedError, Repository } from 'typeorm';

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

@Injectable()
export class AttendanceEventsService {
  // Hozir bitta Nest jarayoni ichida parallel ishga tushishni cheklaydi.
  // Worker bosqichida Redis orqali umumiy qulf qo‘shamiz.
  private readonly runningTerminals = new Set<number>();

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly terminalCrypto: TerminalCryptoService,
    private readonly hikvisionEvents: HikvisionEventsService,
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

    if (this.runningTerminals.has(dto.terminalId)) {
      throw new ConflictException('Ushbu terminaldan eventlar hozir olinmoqda');
    }

    this.runningTerminals.add(dto.terminalId);

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

                try {
                  await repository.insert({
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

                  counts.inserted++;

                  if (pictureUrl) {
                    counts.photosQueued++;
                  }
                } catch (error: unknown) {
                  if (error instanceof QueryFailedError) {
                    const driverError = error.driverError as {
                      code?: string;
                    };

                    if (driverError.code === 'ER_DUP_ENTRY') {
                      counts.duplicates++;
                      continue;
                    }
                  }

                  throw error;
                }
              }

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

      return {
        success: true,
        terminalId: terminal.id,
        startTime: dto.startTime,
        endTime: dto.endTime,
        completedAt: new Date(),
        ...statistics,
      };
    } finally {
      this.runningTerminals.delete(dto.terminalId);
    }
  }
}
