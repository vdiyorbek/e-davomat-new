import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventSyncTerminalLockService } from './event-sync-terminal-lock.service';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Terminal } from '../terminals/terminal.entity';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import {
  HikvisionPhotoService,
  HikvisionPhotoPermanentError,
} from '../terminals/hikvision-photo.service';

import { AttendanceEvent } from './attendance-event.entity';
import { EventPhotoStatus } from './enums/event-photo-status.enum';
import { DownloadEventPhotosDto } from './dto/download-event-photos.dto';

export interface PhotoResult {
  eventId: string;
  status: EventPhotoStatus;
  message?: string;
}

export interface DownloadEventPhotosResponse {
  terminalId: number;
  processed: number;
  downloaded: number;
  failed: number;
  missing: number;
  results: PhotoResult[];
}

function getSafePhotoError(
  error: unknown,
  stage: 'download' | 'storage',
): string {
  if (stage === 'storage') {
    return 'Rasmni server diskiga saqlab bo‘lmadi';
  }

  if (error instanceof HikvisionPhotoPermanentError) {
    return error.message.slice(0, 500);
  }

  if (!(error instanceof Error)) {
    return 'Rasmni yuklashda noma’lum xatolik';
  }

  const allowedMessages = [
    'Rasmni olish vaqti tugadi',
    'Terminal rasmni olishga ruxsat bermadi',
    'Terminal Digest ma’lumotini qaytarmadi',
    'Terminal bo‘sh rasm qaytardi',
    'Rasmni olib bo‘lmadi:',
    'Rasm so‘rovi HTTP ',
  ];

  if (allowedMessages.some((prefix) => error.message.startsWith(prefix))) {
    return error.message.slice(0, 500);
  }

  return 'Rasmni yuklashda kutilmagan xatolik';
}

@Injectable()
export class AttendanceEventPhotosService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventsRepository: Repository<AttendanceEvent>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly terminalCrypto: TerminalCryptoService,
    private readonly hikvisionPhoto: HikvisionPhotoService,

    private readonly eventSyncLock: EventSyncTerminalLockService,
  ) {}

  async getPhotoIssues(terminalId: number, limit = 50) {
    if (!Number.isSafeInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('Terminal ID noto‘g‘ri');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit 1 dan 100 gacha bo‘lishi kerak');
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const query = this.eventsRepository
      .createQueryBuilder('event')
      .where('event.terminalId = :terminalId', {
        terminalId,
      })
      .andWhere('event.photoStatus IN (:...statuses)', {
        statuses: [EventPhotoStatus.FAILED, EventPhotoStatus.MISSING],
      });

    const total = await query.clone().getCount();

    const events = await query
      .select([
        'event.id',
        'event.eventAt',
        'event.photoStatus',
        'event.photoAttempts',
        'event.photoLastAttemptAt',
        'event.photoLastError',
      ])
      .orderBy('event.eventAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit)
      .getMany();

    return {
      success: true,
      terminalId,
      total,
      limit,
      items: events.map((event) => ({
        eventId: event.id,
        eventAt: event.eventAt,
        status: event.photoStatus,
        attempts: event.photoAttempts,
        lastAttemptAt: event.photoLastAttemptAt,
        lastError: event.photoLastError,
      })),
    };
  }

  async getPhotoStats(terminalId?: number) {
    const query = this.eventsRepository.createQueryBuilder('event');

    if (terminalId !== undefined) {
      query.where('event.terminalId = :terminalId', { terminalId });
    }

    const rows = await query
      .select('event.terminalId', 'terminalId')
      .addSelect('event.photoStatus', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('event.terminalId')
      .addGroupBy('event.photoStatus')
      .orderBy('event.terminalId', 'ASC')
      .getRawMany<{
        terminalId: string | number;
        status: EventPhotoStatus;
        total: string;
      }>();

    const stats = new Map<
      number,
      {
        terminalId: number;
        total: number;
        pending: number;
        downloaded: number;
        failed: number;
        missing: number;
      }
    >();

    for (const row of rows) {
      const terminalId = Number(row.terminalId);
      const count = Number(row.total);

      let item = stats.get(terminalId);

      if (!item) {
        item = {
          terminalId,
          total: 0,
          pending: 0,
          downloaded: 0,
          failed: 0,
          missing: 0,
        };

        stats.set(terminalId, item);
      }

      item.total += count;

      switch (row.status) {
        case EventPhotoStatus.PENDING:
          item.pending += count;
          break;

        case EventPhotoStatus.DOWNLOADED:
          item.downloaded += count;
          break;

        case EventPhotoStatus.FAILED:
          item.failed += count;
          break;

        case EventPhotoStatus.MISSING:
          item.missing += count;
          break;
      }
    }

    return {
      success: true,
      terminals: Array.from(stats.values()),
    };
  }

  async retrySinglePhoto(terminalId: number, eventId: string) {
    if (!Number.isSafeInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('Terminal ID noto‘g‘ri');
    }

    if (!/^[1-9]\d{0,19}$/.test(eventId)) {
      throw new BadRequestException('Event ID noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      throw new BadRequestException('Terminal nofaol');
    }

    const event = await this.eventsRepository
      .createQueryBuilder('event')
      .addSelect('event.sourcePictureUrl')
      .where('event.id = :eventId', { eventId })
      .andWhere('event.terminalId = :terminalId', { terminalId })
      .getOne();

    if (!event) {
      throw new NotFoundException('Event topilmadi');
    }

    if (
      ![EventPhotoStatus.FAILED, EventPhotoStatus.MISSING].includes(
        event.photoStatus,
      )
    ) {
      throw new BadRequestException(
        'Faqat FAILED yoki MISSING holatidagi rasmni qayta tekshirish mumkin',
      );
    }

    if (!event.sourcePictureUrl?.trim()) {
      throw new BadRequestException('Eventda rasm manzili mavjud emas');
    }

    if (event.photoPath) {
      throw new BadRequestException('Eventda saqlangan rasm manzili mavjud');
    }

    const update = this.eventsRepository
      .createQueryBuilder()
      .update(AttendanceEvent)
      .set({
        photoStatus: EventPhotoStatus.PENDING,
        photoAttempts: 0,
        photoLastAttemptAt: null,
      })
      .where('id = :eventId', { eventId })
      .andWhere('terminalId = :terminalId', { terminalId })
      .andWhere('photoStatus IN (:...statuses)', {
        statuses: [EventPhotoStatus.FAILED, EventPhotoStatus.MISSING],
      })
      .andWhere('photoPath IS NULL')
      .andWhere('sourcePictureUrl IS NOT NULL')
      .andWhere("TRIM(sourcePictureUrl) <> ''");

    const updated = await update.execute();

    if (updated.affected !== 1) {
      throw new BadRequestException(
        'Rasm holati o‘zgargan. Ro‘yxatni yangilang',
      );
    }

    return {
      success: true,
      terminalId,
      eventId,
      status: EventPhotoStatus.PENDING,
      message: 'Rasm qayta yuklashga tayyorlandi',
    };
  }

  async retryMissingPhotos(terminalId: number) {
    if (!Number.isSafeInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('Terminal ID noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id: terminalId,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    // Har bir so'rovda ko'pi bilan 100 ta rasmni
    // qayta tekshirish uchun tayyorlaymiz.
    const events = await this.eventsRepository
      .createQueryBuilder('event')
      .select('event.id')
      .where('event.terminalId = :terminalId', {
        terminalId,
      })
      .andWhere('event.photoStatus = :status', {
        status: EventPhotoStatus.MISSING,
      })
      .andWhere('event.sourcePictureUrl IS NOT NULL')
      .andWhere("event.sourcePictureUrl <> ''")
      .orderBy('event.id', 'ASC')
      .take(100)
      .getMany();

    if (events.length === 0) {
      return {
        success: true,
        terminalId,
        reset: 0,
      };
    }

    const ids = events.map((event) => event.id);

    const result = await this.eventsRepository
      .createQueryBuilder()
      .update(AttendanceEvent)
      .set({
        photoStatus: EventPhotoStatus.PENDING,
        photoAttempts: 0,
        photoLastAttemptAt: null,
        photoLastError: null,
      })
      .whereInIds(ids)
      .andWhere('photoStatus = :status', {
        status: EventPhotoStatus.MISSING,
      })
      .execute();

    return {
      success: true,
      terminalId,
      reset: result.affected ?? 0,
    };
  }

  async downloadPending(
    dto: DownloadEventPhotosDto,
  ): Promise<DownloadEventPhotosResponse> {
    const lease = await this.eventSyncLock.acquire(dto.terminalId, 'photos');

    try {
      await lease.assertOwned();
      const terminal = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .addSelect('terminal.passwordEncrypted')
        .where('terminal.id = :id', { id: dto.terminalId })
        .getOne();

      if (!terminal) {
        throw new NotFoundException('Terminal topilmadi');
      }

      if (!terminal.isActive) {
        throw new BadRequestException('Terminal o‘chirilgan');
      }

      let password: string;

      try {
        password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);
      } catch {
        throw new InternalServerErrorException(
          'Terminal parolini ochib bo‘lmadi',
        );
      }

      const now = Date.now();

      const retry1m = new Date(now - 60_000);
      const retry5m = new Date(now - 5 * 60_000);
      const retry15m = new Date(now - 15 * 60_000);
      const retry1h = new Date(now - 60 * 60_000);
      const retry6h = new Date(now - 6 * 60 * 60_000);

      const events = await this.eventsRepository
        .createQueryBuilder('event')
        .addSelect('event.sourcePictureUrl')
        .where('event.terminalId = :terminalId', {
          terminalId: terminal.id,
        })
        .andWhere('event.photoStatus IN (:...statuses)', {
          statuses: [EventPhotoStatus.PENDING, EventPhotoStatus.FAILED],
        })
        .andWhere('event.photoAttempts < :maxAttempts', {
          maxAttempts: 1000,
        })
        .andWhere(
          `(
    event.photoLastAttemptAt IS NULL
    OR (
      event.photoAttempts < 3
      AND event.photoLastAttemptAt <= :retry1m
    )
    OR (
      event.photoAttempts BETWEEN 3 AND 5
      AND event.photoLastAttemptAt <= :retry5m
    )
    OR (
      event.photoAttempts BETWEEN 6 AND 9
      AND event.photoLastAttemptAt <= :retry15m
    )
    OR (
      event.photoAttempts BETWEEN 10 AND 19
      AND event.photoLastAttemptAt <= :retry1h
    )
    OR (
      event.photoAttempts >= 20
      AND event.photoLastAttemptAt <= :retry6h
    )
  )`,
          {
            retry1m,
            retry5m,
            retry15m,
            retry1h,
            retry6h,
          },
        )
        .orderBy('event.id', 'ASC')
        .take(dto.limit)
        .getMany();

      const results: PhotoResult[] = [];

      for (const event of events) {
        await lease.assertOwned();
        if (!event.sourcePictureUrl) {
          await this.eventsRepository.update(event.id, {
            photoStatus: EventPhotoStatus.MISSING,
            photoLastError: 'Eventda rasm manzili mavjud emas',
          });

          results.push({
            eventId: event.id,
            status: EventPhotoStatus.MISSING,
            message: 'Eventda rasm manzili mavjud emas',
          });

          continue;
        }

        await this.eventsRepository.update(event.id, {
          photoAttempts: () => '`photoAttempts` + 1',
          photoLastAttemptAt: new Date(),
        });

        let savedFile: string | null = null;
        let stage: 'download' | 'storage' = 'download';

        try {
          const image = await this.hikvisionPhoto.download(
            terminal,
            password,
            event.sourcePictureUrl,
          );

          stage = 'storage';

          // Papkalar UTC sana bo‘yicha tartiblanadi.
          const [year, month, day] = event.eventAt
            .toISOString()
            .slice(0, 10)
            .split('-');

          const relativeDirectory = [
            'uploads',
            'attendance',
            String(terminal.id),
            year,
            month,
            day,
          ].join('/');

          const absoluteDirectory = join(process.cwd(), relativeDirectory);

          await mkdir(absoluteDirectory, { recursive: true });

          const fileName = `${event.id}-${randomUUID()}.jpg`;
          const relativePath = `${relativeDirectory}/${fileName}`;
          const absolutePath = join(absoluteDirectory, fileName);

          savedFile = absolutePath;

          await writeFile(absolutePath, image, {
            flag: 'wx',
          });

          const updated = await this.eventsRepository.update(event.id, {
            photoPath: relativePath,
            photoStatus: EventPhotoStatus.DOWNLOADED,
            photoLastError: null,
          });

          if (updated.affected !== 1) {
            throw new Error('Event yozuvini yangilab bo‘lmadi');
          }

          results.push({
            eventId: event.id,
            status: EventPhotoStatus.DOWNLOADED,
          });
        } catch (error: unknown) {
          if (savedFile) {
            await unlink(savedFile).catch(() => undefined);
          }

          if (error instanceof QueryFailedError) {
            throw new InternalServerErrorException(
              'Rasm ma’lumotini bazaga saqlab bo‘lmadi',
            );
          }

          const isPermanentError =
            stage === 'download' &&
            error instanceof HikvisionPhotoPermanentError;

          const isNotFound = isPermanentError && error.code === 'NOT_FOUND';

          const nextAttempt = event.photoAttempts + 1;

          // 404 xatosiga uch marta imkon beramiz.
          // Boshqa permanent xatolar darhol to'xtatiladi.
          const shouldStopRetry =
            isPermanentError && (!isNotFound || nextAttempt >= 3);

          const nextStatus = shouldStopRetry
            ? EventPhotoStatus.MISSING
            : EventPhotoStatus.FAILED;

          await lease.assertOwned();

          const errorMessage = getSafePhotoError(error, stage);

          await this.eventsRepository.update(event.id, {
            photoStatus: nextStatus,
            photoLastError: errorMessage,
          });

          results.push({
            eventId: event.id,
            status: nextStatus,
            message: errorMessage,
          });
        }
      }

      return {
        terminalId: terminal.id,
        processed: results.length,
        downloaded: results.filter(
          (item) => item.status === EventPhotoStatus.DOWNLOADED,
        ).length,
        failed: results.filter(
          (item) => item.status === EventPhotoStatus.FAILED,
        ).length,
        missing: results.filter(
          (item) => item.status === EventPhotoStatus.MISSING,
        ).length,
        results,
      };
    } finally {
      await lease.release();
    }
  }
}
