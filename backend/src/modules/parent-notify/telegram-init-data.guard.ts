import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { telegramConfig } from './telegram-api.service';

export interface ParentLink {
  id: number;
  telegramUserId: number;
  chatId: number;
  phoneKey: string;
  language: string;
  notifyArrival: number;
  notifyLeave: number;
  notifyAbsent: number;
  notifyExcuse: number;
}

export interface ParentRequest extends Request {
  parentLink?: ParentLink;
}

const MAX_AGE_SECONDS = 24 * 3600;

/** Telegram Mini App `initData` imzosini tekshiradi (HMAC-SHA256, bot tokeni bilan). */
export function verifyInitData(
  initData: string,
  token: string,
  now = Date.now(),
): number | null {
  if (!initData || !token || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > MAX_AGE_SECONDS)
    return null;
  try {
    const user = JSON.parse(params.get('user') ?? '{}') as { id?: number };
    return typeof user.id === 'number' ? user.id : null;
  } catch {
    return null;
  }
}

@Injectable()
export class TelegramInitDataGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ParentRequest>();
    const header = request.headers['x-telegram-init-data'];
    const initData = typeof header === 'string' ? header : '';
    const userId = verifyInitData(initData, telegramConfig().token);
    if (userId === null)
      throw new UnauthorizedException(
        'Telegram imzosi noto‘g‘ri yoki eskirgan',
      );

    const [link]: ParentLink[] = await this.dataSource.query(
      `SELECT * FROM parent_telegram_links WHERE telegramUserId = ? AND phoneKey IS NOT NULL`,
      [userId],
    );
    if (!link) throw new ForbiddenException('NOT_LINKED');
    request.parentLink = link;
    return true;
  }
}
