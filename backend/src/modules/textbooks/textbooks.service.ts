import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource, Repository } from 'typeorm';

import { Subject } from '../subjects/subject.entity';
import { UserRole } from '../users/enums/user-role.enum';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { Textbook, TextbookProcessingStatus } from './textbook.entity';

import { UploadTextbookDto } from './dto/upload-textbook.dto';
import { UpdateTextbookDto } from './dto/update-textbook.dto';
import { TextbookTopic, TopicReviewStatus } from './textbook-topic.entity';
const MAX_PDF_SIZE = 30 * 1024 * 1024;

@Injectable()
export class TextbooksService {
  private readonly directory = join(process.cwd(), 'uploads', 'textbooks');

  constructor(
    @InjectRepository(Textbook)
    private readonly textbooksRepository: Repository<Textbook>,

    @InjectRepository(Subject)
    private readonly subjectsRepository: Repository<Subject>,

    private readonly dataSource: DataSource,
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

  async findAll() {
    return this.textbooksRepository.find({
      select: {
        id: true,
        subjectId: true,
        gradeLevel: true,
        title: true,
        languageCode: true,
        publisher: true,
        publicationYear: true,
        approvalReference: true,
        processingStatus: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
      order: {
        id: 'DESC',
      },
      take: 200,
    });
  }

  private requireSuperAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Ushbu amal faqat bosh administratorga ruxsat etilgan',
      );
    }
  }

  // READ: bitta darslik ma'lumotlari
  async findOne(id: number) {
    const textbook = await this.textbooksRepository.findOneBy({
      id,
    });

    if (!textbook) {
      throw new NotFoundException('Darslik topilmadi');
    }

    // PDF'ning ichki saqlash ma'lumotlarini qaytarmaymiz.
    return {
      id: textbook.id,
      subjectId: textbook.subjectId,
      gradeLevel: textbook.gradeLevel,
      title: textbook.title,
      languageCode: textbook.languageCode,
      publisher: textbook.publisher,
      publicationYear: textbook.publicationYear,
      approvalReference: textbook.approvalReference,
      processingStatus: textbook.processingStatus,
      isVerified: textbook.isVerified,
      isActive: textbook.isActive,
      createdAt: textbook.createdAt,
      updatedAt: textbook.updatedAt,
    };
  }

  // UPDATE: darslik ma'lumotlarini o'zgartirish
  async update(id: number, dto: UpdateTextbookDto, actor: AuthenticatedUser) {
    this.requireSuperAdmin(actor);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('O‘zgartiriladigan ma’lumot yuborilmagan');
    }

    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const textbook = await manager.findOne(Textbook, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!textbook) {
        throw new NotFoundException('Darslik topilmadi');
      }

      const next = {
        subjectId: dto.subjectId ?? textbook.subjectId,
        gradeLevel: dto.gradeLevel ?? textbook.gradeLevel,
        title: dto.title ?? textbook.title,
        languageCode: dto.languageCode ?? textbook.languageCode,
        publisher:
          dto.publisher === undefined ? textbook.publisher : dto.publisher,
        publicationYear:
          dto.publicationYear === undefined
            ? textbook.publicationYear
            : dto.publicationYear,
        approvalReference:
          dto.approvalReference === undefined
            ? textbook.approvalReference
            : dto.approvalReference,
        isActive: dto.isActive ?? textbook.isActive,
      };

      // Fan almashtirilsa yoki darslik tiklansa,
      // yangi fan faol bo'lishi kerak.
      if (
        dto.subjectId !== undefined ||
        (next.isActive && !textbook.isActive)
      ) {
        const subject = await manager.findOneBy(Subject, {
          id: next.subjectId,
          isActive: true,
        });

        if (!subject) {
          throw new BadRequestException(
            'Tanlangan fan mavjud emas yoki faol emas',
          );
        }
      }

      const classificationChanged =
        next.subjectId !== textbook.subjectId ||
        next.gradeLevel !== textbook.gradeLevel ||
        next.languageCode !== textbook.languageCode;

      const metadataChanged =
        classificationChanged ||
        next.title !== textbook.title ||
        next.publisher !== textbook.publisher ||
        next.publicationYear !== textbook.publicationYear ||
        next.approvalReference !== textbook.approvalReference;

      Object.assign(textbook, next);

      // Ma'lumotlar o'zgarganda qayta tekshirish zarur.
      if (metadataChanged) {
        textbook.isVerified = false;
      }

      await manager.save(Textbook, textbook);

      // Fan, sinf yoki til o'zgarsa, avval tasdiqlangan
      // mavzular qayta tekshiruvga o'tkaziladi.
      if (classificationChanged) {
        await manager.getRepository(TextbookTopic).update(
          {
            textbookId: id,
            reviewStatus: TopicReviewStatus.APPROVED,
          },
          {
            reviewStatus: TopicReviewStatus.PENDING_REVIEW,
          },
        );
      }
    });

    return this.findOne(id);
  }

  // DELETE: darslikni arxivlash
  async archive(id: number, actor: AuthenticatedUser) {
    this.requireSuperAdmin(actor);

    return this.update(id, { isActive: false }, actor);
  }

  async getPdf(id: number): Promise<Buffer> {
    const textbook = await this.textbooksRepository.findOneBy({ id });

    if (!textbook) {
      throw new NotFoundException('Darslik topilmadi');
    }

    const key = textbook.fileStorageKey;

    if (
      !key ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(
        key,
      )
    ) {
      throw new NotFoundException('PDF fayl mavjud emas');
    }

    const path = join(this.directory, key);

    let pdf: Buffer;

    try {
      const info = await stat(path);

      if (!info.isFile() || info.size < 100 || info.size > MAX_PDF_SIZE) {
        throw new BadRequestException('PDF fayl hajmi noto‘g‘ri');
      }

      pdf = await readFile(path);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new NotFoundException('PDF faylni serverdan o‘qib bo‘lmadi');
    }

    const hash = createHash('sha256').update(pdf).digest('hex');

    if (!textbook.fileSha256 || hash !== textbook.fileSha256) {
      throw new BadRequestException('PDF fayl yaxlitligi buzilgan');
    }

    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('Fayl PDF formatida emas');
    }

    return pdf;
  }
}
