
import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';

import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';

import { Terminal } from '../terminals/terminal.entity';

import {
  HIKVISION_PUSH_JOB,
  HIKVISION_PUSH_QUEUE,
} from './hikvision-push.types';

import type { PushJob } from './hikvision-push.types';

const BODY_LIMIT = 2 * 1024 * 1024;

@Controller('hikvision-push')
export class HikvisionPushController {
  private readonly logger = new Logger(
    HikvisionPushController.name,
  );

  constructor(
    @InjectQueue(HIKVISION_PUSH_QUEUE)
    private readonly queue: Queue<PushJob>,

    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
  ) { }

  @Post(':token')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request,
  ): Promise<{ accepted: boolean }> {
    const token = String(req.params.token || '');

    // Faqat 64 belgili hex tokenlar
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new UnauthorizedException(
        'Webhook autentifikatsiyasi rad etildi',
      );
    }

    const tokenHash = createHash('sha256')
      .update(token.toLowerCase(), 'utf8')
      .digest('hex');

    // select:false bo'lgan token xeshini
    // faqat autentifikatsiya uchun o'qiymiz.
    const terminal = await this.terminals
      .createQueryBuilder('terminal')
      .addSelect('terminal.pushTokenHash')
      .where('terminal.pushTokenHash = :tokenHash', {
        tokenHash,
      })
      .andWhere('terminal.pushEnabled = :enabled', {
        enabled: true,
      })
      .andWhere('terminal.isActive = :active', {
        active: true,
      })
      .andWhere('terminal.archivedAt IS NULL')
      .getOne();

    if (!terminal) {
      throw new UnauthorizedException(
        'Webhook autentifikatsiyasi rad etildi',
      );
    }

    const body: unknown = req.body;

    if (
      !Buffer.isBuffer(body) ||
      body.length === 0 ||
      body.length > BODY_LIMIT
    ) {
      throw new BadRequestException(
        'HTTP body noto‘g‘ri yoki hajmi oshgan',
      );
    }

    const contentType = String(
      req.headers['content-type'] || '',
    ).slice(0, 200);

    if (
      !/^(multipart\/(form-data|mixed)|application\/(json|xml)|text\/xml)\b/i.test(
        contentType,
      )
    ) {
      throw new BadRequestException(
        'Content-Type qo‘llab-quvvatlanmaydi',
      );
    }

    const sourceIp = (
      req.ip ||
      req.socket.remoteAddress ||
      ''
    ).replace(/^::ffff:/, '');

    const jobId = `push-${terminal.id}-${randomUUID()}`;

    try {
      await this.queue.add(
        HIKVISION_PUSH_JOB,
        {
          terminalId: terminal.id,
          sourceIp,
          contentType,
          bodyBase64: body.toString('base64'),
          receivedAt: new Date().toISOString(),
        },
        {
          jobId,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 86400,
            count: 100000,
          },
          removeOnFail: false,
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        `HTTP Push queue xatosi, terminalId=${terminal.id}: ${error instanceof Error ? error.message : 'unknown'
        }`,
      );

      throw new ServiceUnavailableException(
        'Eventni navbatga saqlab bo‘lmadi',
      );
    }

    // Terminalga 200 OK faqat BullMQ qabul qilgach
    // qaytariladi. MySQL yozuvi keyin workerda bajariladi.
    return { accepted: true };
  }
}
