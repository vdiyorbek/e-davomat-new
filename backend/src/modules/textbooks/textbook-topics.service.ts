import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTextbookTopicDto } from './dto/update-textbook-topic.dto';
import { DataSource } from 'typeorm';
import { CreateTextbookTopicDto } from './dto/create-textbook-topic.dto';
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
    if (!textbook.isActive) {
      throw new ConflictException(
        'Arxivlangan darslikni tahlil qilish mumkin emas',
      );
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

  // 1. Darslik mavzularini olish
  async findByTextbook(textbookId: number, actor: AuthenticatedUser) {
    this.requireSuperAdmin(actor);

    const textbook = await this.dataSource
      .getRepository(Textbook)
      .findOneBy({ id: textbookId });

    if (!textbook) {
      throw new NotFoundException('Darslik topilmadi');
    }

    const topics = await this.dataSource.getRepository(TextbookTopic).find({
      where: { textbookId },
      order: { orderIndex: 'ASC' },
    });

    return {
      textbookId: textbook.id,
      textbookTitle: textbook.title,
      total: topics.length,
      topics,
    };
  }

  // 2. Mavzuni tahrirlash
  async updateTopic(
    topicId: number,
    dto: UpdateTextbookTopicDto,
    actor: AuthenticatedUser,
  ) {
    this.requireSuperAdmin(actor);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('O‘zgartiriladigan ma’lumot yuborilmagan');
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const topic = await manager.findOne(TextbookTopic, {
        where: { id: topicId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!topic) {
        throw new NotFoundException('Mavzu topilmadi');
      }

      const title = dto.title === undefined ? topic.title : dto.title.trim();

      const chapterTitle =
        dto.chapterTitle === undefined
          ? topic.chapterTitle
          : dto.chapterTitle?.trim() || null;

      const pageStart =
        dto.pageStart === undefined ? topic.pageStart : dto.pageStart;

      const pageEnd = dto.pageEnd === undefined ? topic.pageEnd : dto.pageEnd;

      if (!title || title.length > 255) {
        throw new BadRequestException('Mavzu nomi noto‘g‘ri');
      }

      if (pageStart !== null && pageEnd !== null && pageStart > pageEnd) {
        throw new BadRequestException(
          'Boshlanish sahifasi tugash sahifasidan katta',
        );
      }

      const changed =
        topic.title !== title ||
        topic.chapterTitle !== chapterTitle ||
        topic.pageStart !== pageStart ||
        topic.pageEnd !== pageEnd;

      if (!changed) {
        return topic;
      }

      topic.title = title;
      topic.chapterTitle = chapterTitle;
      topic.pageStart = pageStart;
      topic.pageEnd = pageEnd;

      // Tahrirlangan mavzu qayta tasdiqlanishi kerak.
      topic.reviewStatus = TopicReviewStatus.PENDING_REVIEW;

      return manager.save(TextbookTopic, topic);
    });
  }

  // 3. Mavzuni tasdiqlash
  async approveTopic(topicId: number, actor: AuthenticatedUser) {
    this.requireSuperAdmin(actor);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const topic = await manager.findOne(TextbookTopic, {
        where: { id: topicId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!topic) {
        throw new NotFoundException('Mavzu topilmadi');
      }

      if (topic.reviewStatus === TopicReviewStatus.APPROVED) {
        return topic;
      }

      topic.reviewStatus = TopicReviewStatus.APPROVED;

      return manager.save(TextbookTopic, topic);
    });
  }

  // Mavzuni qo'lda yaratish
  async createManualTopic(
    textbookId: number,
    dto: CreateTextbookTopicDto,
    actor: AuthenticatedUser,
  ): Promise<TextbookTopic> {
    this.requireSuperAdmin(actor);

    const title = dto.title.trim();
    const chapterTitle = dto.chapterTitle?.trim() || null;

    if (!title) {
      throw new BadRequestException('Mavzu nomi bo‘sh bo‘lmasligi kerak');
    }

    const pageStart = dto.pageStart ?? null;
    const pageEnd = dto.pageEnd ?? null;

    if (pageStart !== null && pageEnd !== null && pageStart > pageEnd) {
      throw new BadRequestException(
        'Boshlanish sahifasi tugash sahifasidan katta',
      );
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Bir darslikka parallel qo'shishlarda
      // tartib raqami takrorlanmasligi uchun.
      const textbook = await manager.findOne(Textbook, {
        where: { id: textbookId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!textbook) {
        throw new NotFoundException('Darslik topilmadi');
      }

      if (!textbook.isActive) {
        throw new ConflictException('Darslik faol emas');
      }

      const repository = manager.getRepository(TextbookTopic);

      const total = await repository.countBy({ textbookId });

      if (total >= 500) {
        throw new ConflictException(
          'Bir darslikda 500 tadan ortiq mavzu bo‘lishi mumkin emas',
        );
      }

      const result = await repository
        .createQueryBuilder('topic')
        .select('MAX(topic.orderIndex)', 'maxOrder')
        .where('topic.textbookId = :textbookId', { textbookId })
        .getRawOne<{ maxOrder: string | null }>();

      const maxOrder = Number(result?.maxOrder ?? 0);

      if (!Number.isSafeInteger(maxOrder) || maxOrder >= 4294967295) {
        throw new ConflictException(
          'Mavzular tartib raqami chegarasiga yetgan',
        );
      }

      const topic = repository.create({
        textbookId,
        orderIndex: maxOrder + 1,
        chapterTitle,
        title,
        pageStart,
        pageEnd,
        source: TopicSource.MANUAL,
        reviewStatus: TopicReviewStatus.PENDING_REVIEW,
      });

      return repository.save(topic);
    });
  }

  async approveAllTopics(textbookId: number, actor: AuthenticatedUser) {
    this.requireSuperAdmin(actor);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const textbook = await manager.findOne(Textbook, {
        where: { id: textbookId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!textbook) {
        throw new NotFoundException('Darslik topilmadi');
      }

      if (!textbook.isActive) {
        throw new ConflictException(
          'Arxivlangan darslik mavzularini tasdiqlash mumkin emas',
        );
      }

      const repository = manager.getRepository(TextbookTopic);

      const result = await repository.update(
        {
          textbookId,
          reviewStatus: TopicReviewStatus.PENDING_REVIEW,
        },
        {
          reviewStatus: TopicReviewStatus.APPROVED,
        },
      );

      return {
        textbookId,
        approvedCount: result.affected ?? 0,
      };
    });
  }
}
