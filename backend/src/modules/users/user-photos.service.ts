import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { IsNull, Repository } from 'typeorm';

import { User } from './user.entity';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 0,
  [UserRole.SCHOOL_ADMIN]: 1,
  [UserRole.DISTRICT_ADMIN]: 2,
  [UserRole.REGION_ADMIN]: 3,
  [UserRole.SUPER_ADMIN]: 4,
};

@Injectable()
export class UserPhotosService {
  private readonly directory = join(process.cwd(), 'uploads', 'users');

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  private getVersion(userId: number, photoUrl: string | null): string | null {
    if (!photoUrl) return null;

    const prefix = `/api/users/${userId}/photo?v=`;

    if (!photoUrl.startsWith(prefix)) return null;

    const version = photoUrl.slice(prefix.length);

    return UUID_PATTERN.test(version) ? version : null;
  }

  private getFilePath(userId: number, version: string) {
    return join(this.directory, `${userId}-${version}.jpg`);
  }

  private async removeOldPhoto(
    userId: number,
    oldUrl: string | null,
  ): Promise<void> {
    const version = this.getVersion(userId, oldUrl);

    if (!version) return;

    await unlink(this.getFilePath(userId, version)).catch(() => undefined);
  }

  private async authorize(
    userId: number,
    actor: AuthenticatedUser,
    write: boolean,
  ): Promise<User> {
    const target = await this.usersRepository.findOneBy({
      id: userId,
    });

    if (!target) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    // Har bir faol foydalanuvchi o‘z rasmini boshqaradi.
    if (actor.id === target.id) {
      return target;
    }

    // Boshqa akkaunt uchun hududiy vakolatni tekshiramiz.
    await this.usersService.findOne(userId, actor);

    // Boshqa foydalanuvchi rasmini o‘zgartirish uchun
    // administratorning roli yuqoriroq bo‘lishi kerak.
    if (write && ROLE_RANK[actor.role] <= ROLE_RANK[target.role]) {
      throw new ForbiddenException(
        'Ushbu foydalanuvchi rasmini o‘zgartirishga ruxsat yo‘q',
      );
    }

    return target;
  }

  async upload(
    userId: number,
    actor: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: number; photoUrl: string }> {
    const user = await this.authorize(userId, actor, true);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm tanlang');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');
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
        throw new BadRequestException(
          'Faqat JPEG, PNG yoki WebP rasm qabul qilinadi',
        );
      }

      if ((metadata.pages ?? 1) > 1) {
        throw new BadRequestException('Animatsiyali rasm qabul qilinmaydi');
      }

      imageBuffer = await processor
        .rotate()
        .resize({
          width: 600,
          height: 600,
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({
          quality: 88,
          progressive: false,
        })
        .toBuffer();
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Rasmni qayta ishlab bo‘lmadi');
    }

    const version = randomUUID();
    const filePath = this.getFilePath(userId, version);
    const photoUrl = `/api/users/${userId}/photo?v=${version}`;

    await mkdir(this.directory, { recursive: true });
    await writeFile(filePath, imageBuffer, { flag: 'wx' });

    try {
      // Bir vaqtda kelgan ikki so‘rov bir-birining
      // yangilanishini tasodifan bosib ketmasin.
      const result = await this.usersRepository.update(
        {
          id: userId,
          photoUrl: user.photoUrl ?? IsNull(),
        },
        { photoUrl },
      );

      if (result.affected !== 1) {
        throw new ConflictException(
          'Rasm holati o‘zgargan. Qayta urinib ko‘ring',
        );
      }
    } catch (error: unknown) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }

    await this.removeOldPhoto(userId, user.photoUrl);

    return { id: userId, photoUrl };
  }

  async read(userId: number, actor: AuthenticatedUser): Promise<Buffer> {
    const user = await this.authorize(userId, actor, false);

    const version = this.getVersion(userId, user.photoUrl);

    if (!version) {
      throw new NotFoundException('Foydalanuvchining rasmi mavjud emas');
    }

    try {
      return await readFile(this.getFilePath(userId, version));
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

  async remove(
    userId: number,
    actor: AuthenticatedUser,
  ): Promise<{ id: number; photoUrl: null }> {
    const user = await this.authorize(userId, actor, true);

    if (user.photoUrl) {
      const result = await this.usersRepository.update(
        {
          id: userId,
          photoUrl: user.photoUrl,
        },
        { photoUrl: null },
      );

      if (result.affected !== 1) {
        throw new ConflictException(
          'Rasm holati o‘zgargan. Qayta urinib ko‘ring',
        );
      }

      await this.removeOldPhoto(userId, user.photoUrl);
    }

    return { id: userId, photoUrl: null };
  }
}
