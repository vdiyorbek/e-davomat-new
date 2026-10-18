import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { Textbook, TextbookProcessingStatus } from './textbook.entity';

import {
  TextbookTopic,
  TopicReviewStatus,
  TopicSource,
} from './textbook-topic.entity';

import type { ExtractedTextbookTopic } from './gemini-textbook.service';

@Injectable()
export class TextbookTopicsService {
  constructor(private readonly dataSource: DataSource) {}

  private requireSuperAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Ushbu amal faqat bosh administratorga ruxsat etilgan',
      );
    }
  }

  // Mavjud mavzular uchun Gemini'ni qayta chaqirmaymiz.
  async ensureCanExtract(
    textbookId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    this.requireSuperAdmin(actor);

    const textbook = await this.dataSource
      .getRepository(Textbook)
      .findOneBy({ id: textbookId });

    if (!textbook) {
      throw new NotFoundException('Darslik topilmadi');
    }

    const hasTopics = await this.dataSource
      .getRepository(TextbookTopic)
      .exist({ where: { textbookId } });

    if (hasTopics) {
      throw new ConflictException(
        'Ushbu darslikning mavzulari avval saqlangan',
      );
    }
  }

  async saveExtracted(
    textbookId: number,
    topics: ExtractedTextbookTopic[],
    actor: AuthenticatedUser,
  ): Promise<{
    textbookId: number;
    savedCount: number;
    reviewStatus: TopicReviewStatus;
  }> {
    this.requireSuperAdmin(actor);

    if (!Array.isArray(topics) || topics.length === 0 || topics.length > 500) {
      throw new BadRequestException(
        'Mavzular soni 1 dan 500 tagacha bo‘lishi kerak',
      );
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Parallel so'rovlar mavzularni takroran yaratmasligi uchun.
      const textbook = await manager.findOne(Textbook, {
        where: { id: textbookId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!textbook) {
        throw new NotFoundException('Darslik topilmadi');
      }

      const repository = manager.getRepository(TextbookTopic);

      const existingCount = await repository.countBy({
        textbookId,
      });

      if (existingCount > 0) {
        throw new ConflictException(
          'Mavjud mavzular avtomatik almashtirilmaydi',
        );
      }

      const entities = topics.map((topic, index) => {
        const title = typeof topic.title === 'string' ? topic.title.trim() : '';

        const chapterTitle =
          typeof topic.chapterTitle === 'string'
            ? topic.chapterTitle.trim()
            : null;

        const start = topic.pageStart;
        const end = topic.pageEnd;

        if (
          !title ||
          title.length > 255 ||
          (chapterTitle !== null && chapterTitle.length > 255) ||
          (start !== null && (!Number.isInteger(start) || start < 1)) ||
          (end !== null && (!Number.isInteger(end) || end < 1)) ||
          (start !== null && end !== null && start > end)
        ) {
          throw new BadRequestException(
            `Mavzu ${index + 1} ma’lumotlari noto‘g‘ri`,
          );
        }

        return repository.create({
          textbookId,
          orderIndex: index + 1,
          chapterTitle: chapterTitle || null,
          title,
          pageStart: start,
          pageEnd: end,
          source: TopicSource.GEMINI,
          reviewStatus: TopicReviewStatus.PENDING_REVIEW,
        });
      });

      await repository.save(entities, { chunk: 100 });

      // PDF tahlili tugagan. Bu administrator tasdig'i emas.
      textbook.processingStatus = TextbookProcessingStatus.READY;

      await manager.save(Textbook, textbook);

      return {
        textbookId,
        savedCount: entities.length,
        reviewStatus: TopicReviewStatus.PENDING_REVIEW,
      };
    });
  }
}
