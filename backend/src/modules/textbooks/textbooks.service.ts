import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Repository } from 'typeorm';

import { Subject } from '../subjects/subject.entity';
import { UserRole } from '../users/enums/user-role.enum';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { Textbook, TextbookProcessingStatus } from './textbook.entity';

import { UploadTextbookDto } from './dto/upload-textbook.dto';

const MAX_PDF_SIZE = 30 * 1024 * 1024;

@Injectable()
export class TextbooksService {
  private readonly directory = join(process.cwd(), 'uploads', 'textbooks');

  constructor(
    @InjectRepository(Textbook)
    private readonly textbooksRepository: Repository<Textbook>,

    @InjectRepository(Subject)
    private readonly subjectsRepository: Repository<Subject>,
  ) {}

  async upload(
    dto: UploadTextbookDto,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ) {
    // Qo'shimcha himoya: faqat bosh administrator.
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Darslik yuklash faqat bosh administratorga ruxsat etilgan',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF fayl tanlanmagan');
    }

    if (file.size > MAX_PDF_SIZE) {
      throw new BadRequestException('PDF hajmi 30 MB dan oshmasligi kerak');
    }

    // Fayl nomi va tarkibini tekshiramiz.
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Faqat PDF fayllar qabul qilinadi');
    }

    const header = file.buffer.subarray(0, 5).toString('ascii');

    if (header !== '%PDF-') {
      throw new BadRequestException('Fayl haqiqiy PDF formatida emas');
    }

    const trailer = file.buffer
      .subarray(Math.max(0, file.buffer.length - 2048))
      .toString('latin1');

    if (!trailer.includes('%%EOF')) {
      throw new BadRequestException('PDF fayl to‘liq emas yoki buzilgan');
    }

    const subject = await this.subjectsRepository.findOneBy({
      id: dto.subjectId,
      isActive: true,
    });

    if (!subject) {
      throw new NotFoundException('Fan topilmadi yoki faol emas');
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // Foydalanuvchi yuborgan fayl nomidan foydalanmaymiz.
    const fileName = `${randomUUID()}.pdf`;

    const filePath = join(this.directory, fileName);

    await mkdir(this.directory, {
      recursive: true,
      mode: 0o700,
    });

    await writeFile(filePath, file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });

    try {
      const textbook = this.textbooksRepository.create({
        subjectId: subject.id,
        gradeLevel: dto.gradeLevel,
        title: dto.title.trim(),
        languageCode: dto.languageCode,
        publisher: dto.publisher?.trim() ?? null,
        publicationYear: dto.publicationYear ?? null,
        approvalReference: dto.approvalReference?.trim() ?? null,

        isVerified: false,
        fileStorageKey: fileName,
        fileSha256: sha256,
        pageCount: null,

        processingStatus: TextbookProcessingStatus.DRAFT,

        isActive: true,
      });

      const saved = await this.textbooksRepository.save(textbook);

      return {
        id: saved.id,
        subjectId: saved.subjectId,
        gradeLevel: saved.gradeLevel,
        title: saved.title,
        languageCode: saved.languageCode,
        processingStatus: saved.processingStatus,
        isVerified: saved.isVerified,
        createdAt: saved.createdAt,
      };
    } catch (error: unknown) {
      // Bazaga yozish amalga oshmasa,
      // diskda ortiqcha fayl qoldirmaymiz.
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }
}
