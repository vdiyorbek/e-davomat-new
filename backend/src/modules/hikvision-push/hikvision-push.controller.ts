import {
  BadRequestException, Controller, HttpCode, HttpStatus, Logger,
  Post, Req, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { HIKVISION_PUSH_JOB, HIKVISION_PUSH_QUEUE } from './hikvision-push.types';
import type { PushJob, TerminalBinding } from './hikvision-push.types';

const BODY_LIMIT = 2 * 1024 * 1024;

@Controller('hikvision-push')
export class HikvisionPushController {
  private readonly logger = new Logger(HikvisionPushController.name);
  private readonly bindings: TerminalBinding[];

  constructor(
    @InjectQueue(HIKVISION_PUSH_QUEUE) private readonly queue: Queue<PushJob>,
    config: ConfigService,
  ) {
    const raw = config.get<string>('HIKVISION_PUSH_TERMINALS_JSON') || '[]';
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('HIKVISION_PUSH_TERMINALS_JSON noto‘g‘ri JSON'); }
    if (!Array.isArray(parsed)) throw new Error('HIKVISION_PUSH_TERMINALS_JSON massiv bo‘lishi kerak');
    this.bindings = parsed.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Terminal binding noto‘g‘ri');
      const b = item as Partial<TerminalBinding>;
      if (!Number.isSafeInteger(b.terminalId) || Number(b.terminalId) <= 0 ||
        typeof b.token !== 'string' || !/^[a-f0-9]{48,128}$/i.test(b.token) ||
        !Array.isArray(b.ips) || !b.ips.length ||
        !b.ips.every((ip) => typeof ip === 'string' && ip.length > 0)) {
        throw new Error('Har bir terminalda terminalId, 48+ hex token va ips bo‘lishi kerak');
      }
      return b as TerminalBinding;
    });
    if (new Set(this.bindings.map(b => b.token)).size !== this.bindings.length) {
      throw new Error('Takroriy webhook token mavjud');
    }
  }

  @Post(':token')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(@Req() req: Request): Promise<{ accepted: boolean }> {
    // Token URLdan keladi; loglarda uni ko‘rsatmang. Express req.params typing bilan.
    const token = String(req.params.token || '');
    const ip = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    const binding = this.bindings.find((b) => {
      const left = Buffer.from(b.token, 'utf8');
      const right = Buffer.from(token, 'utf8');
      return left.length === right.length && timingSafeEqual(left, right);
    });
    if (!binding || !binding.ips.includes(ip)) throw new UnauthorizedException('Sender rad etildi');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > BODY_LIMIT) {
      throw new BadRequestException('Binary HTTP body kerak yoki hajm oshgan');
    }
    const contentType = String(req.headers['content-type'] || '').slice(0, 200);
    if (!/^(multipart\/(form-data|mixed)|application\/(json|xml)|text\/xml)\b/i.test(contentType)) {
      throw new BadRequestException('Content-Type qo‘llab-quvvatlanmaydi');
    }
    // Every delivery gets a separate job; the MySQL unique index makes inserts idempotent.
    // A failed BullMQ job must not silently block a later terminal retry.
    const jobId = `t${binding.terminalId}-${randomUUID()}`;
    try {
      await this.queue.add(HIKVISION_PUSH_JOB, {
        terminalId: binding.terminalId,
        sourceIp: ip,
        contentType,
        bodyBase64: req.body.toString('base64'),
        receivedAt: new Date().toISOString(),
      }, {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 100000 },
        removeOnFail: false,
      });
    } catch (err) {
      this.logger.error(`Queue unavailable: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new ServiceUnavailableException('Qayta yuborish kerak');
    }
    return { accepted: true };
  }
}
