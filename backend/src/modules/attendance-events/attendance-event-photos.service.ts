import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Terminal } from '../terminals/terminal.entity';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import { HikvisionPhotoService } from '../terminals/hikvision-photo.service';

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
  private readonly runningTerminals = new Set<number>();

  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventsRepository: Repository<AttendanceEvent>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly terminalCrypto: TerminalCryptoService,
    private readonly hikvisionPhoto: HikvisionPhotoService,
  ) {}

  async downloadPending(
    dto: DownloadEventPhotosDto,
  ): Promise<DownloadEventPhotosResponse> {
    if (this.runningTerminals.has(dto.terminalId)) {
      throw new ConflictException('Ushbu terminal rasmlari hozir yuklanmoqda');
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

      const retryBefore = new Date(Date.now() - 60_000);

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
          maxAttempts: 5,
        })
        .andWhere(
          `(
            event.photoLastAttemptAt IS NULL
            OR event.photoLastAttemptAt <= :retryBefore
          )`,
          { retryBefore },
        )
        .orderBy('event.id', 'ASC')
        .take(dto.limit)
        .getMany();

      const results: PhotoResult[] = [];

      for (const event of events) {
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

          await this.eventsRepository.update(event.id, {
            photoStatus: EventPhotoStatus.FAILED,
          });

          results.push({
            eventId: event.id,
            status: EventPhotoStatus.FAILED,
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
      this.runningTerminals.delete(dto.terminalId);
    }
  }
}
