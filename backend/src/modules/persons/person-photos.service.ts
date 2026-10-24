import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { Repository } from 'typeorm';

import { Person } from './person.entity';
import { PersonsService } from './persons.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { FacePhotoQualityService } from './face-photo-quality.service';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

// Hozirgi Face-ID integratsiyasi uchun tanlangan limit.
// Terminal firmware/ISAPI talabiga qarab sozlanishi mumkin.
const MAX_OUTPUT_BYTES = 199 * 1024;

@Injectable()
export class PersonPhotosService {
  private readonly directory = join(process.cwd(), 'uploads', 'persons');

  constructor(
    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,
    private readonly personsService: PersonsService,
    private readonly facePhotoQualityService: FacePhotoQualityService,
  ) {}

  private getVersion(personId: number, photoUrl: string | null): string | null {
    if (!photoUrl) return null;

    const pattern = new RegExp(
      `^/api/persons/${personId}/photo\\?v=` +
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' +
        '[0-9a-f]{4}-[0-9a-f]{12})$',
    );

    return pattern.exec(photoUrl)?.[1] ?? null;
  }

  private async removeOldPhoto(
    personId: number,
    oldUrl: string | null,
  ): Promise<void> {
    const version = this.getVersion(personId, oldUrl);
    if (!version) return;

    await unlink(join(this.directory, `${version}.jpg`)).catch(() => undefined);
  }

  private async prepareFacePhoto(input: Buffer): Promise<Buffer> {
    if (!input.length || input.length > MAX_FILE_SIZE) {
      throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');
    }

    try {
      const metadata = await sharp(input, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'warning',
      }).metadata();

      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp'].includes(metadata.format)
      ) {
        throw new BadRequestException('Faqat JPEG, PNG yoki WebP rasm yuklang');
      }

      if ((metadata.pages ?? 1) !== 1) {
        throw new BadRequestException('Animatsiyali rasm qabul qilinmaydi');
      }

      const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);

      const width = rotated ? metadata.height : metadata.width;

      const height = rotated ? metadata.width : metadata.height;

      if (
        !width ||
        !height ||
        Math.min(width, height) < 480 ||
        Math.max(width, height) < 640
      ) {
        throw new BadRequestException(
          'Rasm kamida 640×480 piksel bo‘lishi kerak',
        );
      }

      const portrait = height > width;
      const outputWidth = portrait ? 480 : 640;
      const outputHeight = portrait ? 640 : 480;

      for (const quality of [98, 95, 92, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
        const output = await sharp(input, {
          limitInputPixels: MAX_IMAGE_PIXELS,
          failOn: 'warning',
        })
          .rotate()
          .resize(outputWidth, outputHeight, {
            fit: 'contain',
            background: '#ffffff',
            withoutEnlargement: true,
          })
          .flatten({ background: '#ffffff' })
          .jpeg({
            quality,
            progressive: false,
            mozjpeg: true,
          })
          .toBuffer();

        if (output.length <= MAX_OUTPUT_BYTES) {
          return output;
        }
      }

      throw new BadRequestException(
        'Rasmni 200 KB dan kichik JPEG formatiga ' + 'moslashtirib bo‘lmadi.',
      );
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Rasm buzilgan yoki o‘qib bo‘lmaydigan formatda',
      );
    }
  }

  async upload(
    personId: number,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: number; photoUrl: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm faylini tanlang');
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');
    }

    const person = await this.personsRepository.findOneBy({
      id: personId,
    });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
    }

    const imageBuffer = await this.prepareFacePhoto(file.buffer);
    const qualityResult = await this.facePhotoQualityService.check(file.buffer);

    if (!qualityResult.acceptable) {
      throw new BadRequestException({
        message: 'Rasm sifati Face-ID uchun yetarli emas',
        code: 'FACE_PHOTO_QUALITY_FAILED',
        details: {
          brightness: qualityResult.brightness,
          sharpness: qualityResult.sharpness,
          warnings: qualityResult.warnings,
        },
      });
    }
    await mkdir(this.directory, {
      recursive: true,
    });

    const version = randomUUID();

    const filePath = join(this.directory, `${version}.jpg`);

    const photoUrl = `/api/persons/${personId}/photo?v=${version}`;

    await writeFile(filePath, imageBuffer, {
      flag: 'wx',
    });

    try {
      const update = this.personsRepository
        .createQueryBuilder()
        .update(Person)
        .set({ photoUrl })
        .where('id = :personId', { personId })
        .andWhere('deletedAt IS NULL');

      if (person.photoUrl) {
        update.andWhere('photoUrl = :oldPhotoUrl', {
          oldPhotoUrl: person.photoUrl,
        });
      } else {
        update.andWhere('photoUrl IS NULL');
      }

      const result = await update.execute();

      if (result.affected !== 1) {
        throw new ConflictException(
          'Rasm boshqa so‘rov bilan o‘zgargan. Qayta urinib ko‘ring.',
        );
      }
    } catch (error: unknown) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }

    await this.removeOldPhoto(personId, person.photoUrl);

    return {
      id: personId,
      photoUrl,
    };
  }

  async read(personId: number, user: AuthenticatedUser): Promise<Buffer> {
    const person = await this.personsService.findOne(personId, user);

    if (!person.photoUrl) {
      throw new NotFoundException('Profil rasmi mavjud emas');
    }

    const version = this.getVersion(personId, person.photoUrl);

    if (!version) {
      throw new NotFoundException(
        'Rasm manzili mos emas. Rasmni qayta yuklang.',
      );
    }

    try {
      return await readFile(join(this.directory, `${version}.jpg`));
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new NotFoundException('Rasm fayli topilmadi');
      }

      throw error;
    }
  }
}
