import {
  BadRequestException,
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

@Injectable()
export class PersonPhotosService {
  private readonly directory = join(process.cwd(), 'uploads', 'persons');

  constructor(
    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,

    private readonly personsService: PersonsService,
  ) {}

  async upload(
    personId: number,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: number; photoUrl: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm faylini tanlang');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');
    }

    const person = await this.personsRepository.findOneBy({
      id: personId,
    });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
    }

    let imageBuffer: Buffer;

    try {
      const processor = sharp(file.buffer, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'warning',
      });

      const metadata = await processor.metadata();

      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp'].includes(metadata.format)
      ) {
        throw new BadRequestException('Faqat JPEG, PNG yoki WebP rasm yuklang');
      }

      if ((metadata.pages ?? 1) > 1) {
        throw new BadRequestException(
          'Animatsiyali yoki ko‘p sahifali rasm qabul qilinmaydi',
        );
      }

      imageBuffer = await processor
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({
          quality: 90,
          progressive: false,
        })
        .toBuffer();
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Rasmni o‘qib bo‘lmadi. Fayl buzilgan yoki o‘lchami juda katta.',
      );
    }

    await mkdir(this.directory, { recursive: true });

    const version = randomUUID();
    const filePath = join(this.directory, `${version}.jpg`);
    const photoUrl = `/api/persons/${personId}/photo?v=${version}`;

    await writeFile(filePath, imageBuffer, { flag: 'wx' });

    try {
      // Faqat photoUrl yangilanadi.
      // Boshqa shaxsiy ma’lumotlar o‘zgarmaydi.
      const result = await this.personsRepository
        .createQueryBuilder()
        .update(Person)
        .set({ photoUrl })
        .where('id = :personId', { personId })
        .andWhere('deletedAt IS NULL')
        .execute();

      if (result.affected !== 1) {
        throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
      }
    } catch (error: unknown) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }

    return {
      id: personId,
      photoUrl,
    };
  }

  async read(personId: number, user: AuthenticatedUser): Promise<Buffer> {
    let person: Person;

    if (user.personId === personId) {
      // Har bir foydalanuvchi o‘z rasmini ko‘ra oladi.
      const ownPerson = await this.personsRepository.findOneBy({
        id: personId,
      });

      if (!ownPerson) {
        throw new NotFoundException('Shaxs topilmadi');
      }

      person = ownPerson;
    } else {
      // Boshqa shaxs uchun administrator doirasi tekshiriladi.
      person = await this.personsService.findOne(personId, user);
    }

    if (!person.photoUrl) {
      throw new NotFoundException('Profil rasmi mavjud emas');
    }

    // Diskdagi fayl yo‘lini faqat o‘zimiz yaratgan URLdan olamiz.
    const pattern = new RegExp(
      `^/api/persons/${personId}/photo\\?v=` +
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' +
        '[0-9a-f]{4}-[0-9a-f]{12})$',
    );

    const match = pattern.exec(person.photoUrl);

    if (!match) {
      throw new NotFoundException(
        'Rasm manzili mos emas. Rasmni qayta yuklang.',
      );
    }

    try {
      return await readFile(join(this.directory, `${match[1]}.jpg`));
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
