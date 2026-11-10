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

          await this.eventsRepository.update(event.id, {
            photoStatus: nextStatus,
          });

          results.push({
            eventId: event.id,
            status: nextStatus,
            message:
              stage === 'download' && error instanceof Error
                ? error.message
                : 'Rasmni server diskiga saqlab bo‘lmadi',
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
