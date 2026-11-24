import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';

import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import {
  TelegramApiService,
  setStoredTelegramConfig,
  telegramConfig,
} from './telegram-api.service';

interface Row {
  tokenEnc: string | null;
  secretEnc: string | null;
  publicUrl: string | null;
}

/** Telegram ulanish sozlamalari: bazada shifrlangan, .env — zaxira. Token brauzerga hech qachon qaytarilmaydi. */
@Injectable()
export class TelegramConfigService implements OnModuleInit {
  private readonly logger = new Logger(TelegramConfigService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: TerminalCryptoService,
    private readonly api: TelegramApiService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** Bir nechta nusxa ishlasa ham sozlama o‘zgarishi 1 daqiqada hammasiga yetadi. */
  @Cron('0 * * * * *')
  async reload(): Promise<void> {
    try {
      const [row] = await this.dataSource.query<Row[]>(
        'SELECT tokenEnc, secretEnc, publicUrl FROM telegram_config WHERE id = 1',
      );
      setStoredTelegramConfig({
        token: row?.tokenEnc ? this.crypto.decrypt(row.tokenEnc) : '',
        secret: row?.secretEnc ? this.crypto.decrypt(row.secretEnc) : '',
        publicUrl: row?.publicUrl ?? '',
      });
    } catch (error) {
      this.logger.warn(
        `Telegram sozlamasini o‘qib bo‘lmadi: ${(error as Error).message}`,
      );
    }
  }

  async view() {
    const [row] = await this.dataSource.query<Row[]>(
      'SELECT tokenEnc, secretEnc, publicUrl FROM telegram_config WHERE id = 1',
    );
    const live = telegramConfig();
    const env = {
      token: process.env.TELEGRAM_BOT_TOKEN ?? '',
      secret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
      publicUrl: process.env.PUBLIC_BASE_URL ?? '',
    };
    const source = (inDb: boolean, inEnv: boolean) =>
      inDb ? 'db' : inEnv ? 'env' : null;
    return {
      token: {
        set: live.token !== '',
        source: source(!!row?.tokenEnc, env.token !== ''),
        // faqat oxirgi 4 belgi: qaysi token ekanini ajratish uchun
        hint: live.token ? `…${live.token.slice(-4)}` : null,
      },
      secret: {
        set: live.secret.length >= 16,
        source: source(!!row?.secretEnc, env.secret !== ''),
      },
      publicUrl: live.publicUrl,
      publicUrlSource: source(!!row?.publicUrl, env.publicUrl !== ''),
    };
  }

  async save(
    body: { token?: unknown; publicUrl?: unknown; regenerateSecret?: unknown },
    userId: number,
  ) {
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const urlRaw =
      typeof body.publicUrl === 'string' ? body.publicUrl.trim() : undefined;

    if (token && !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      throw new BadRequestException(
        'Bot tokeni formati noto‘g‘ri (123456:ABC…)',
      );
    }
    let publicUrl: string | undefined;
    if (urlRaw !== undefined) {
      publicUrl = urlRaw.replace(/\/+$/, '');
      if (
        publicUrl &&
        !/^https:\/\/[^\s/]+(:\d+)?(\/[^\s]*)?$/i.test(publicUrl)
      ) {
        throw new BadRequestException(
          'Manzil https:// bilan boshlanishi kerak',
        );
      }
    }

    const [row] = await this.dataSource.query<Row[]>(
      'SELECT tokenEnc, secretEnc, publicUrl FROM telegram_config WHERE id = 1',
    );
    const before = telegramConfig();

    // Yangi token ishlashini saqlashdan oldin tekshiramiz.
    let username: string | null = null;
    if (token) {
      setStoredTelegramConfig({
        token,
        secret: before.secret,
        publicUrl: before.publicUrl,
      });
      try {
        const me = await this.api.call<{ username?: string }>('getMe');
        username = me.username ?? null;
      } catch (error) {
        await this.reload();
        throw new BadRequestException(
          `Token tekshiruvdan o‘tmadi: ${(error as Error).message}`,
        );
      }
    }

    const needSecret =
      body.regenerateSecret === true ||
      (!row?.secretEnc && before.secret.length < 16);
    const secret = needSecret ? randomBytes(24).toString('hex') : null;

    await this.dataSource.query(
      `INSERT INTO telegram_config (id, tokenEnc, secretEnc, publicUrl, updatedById)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tokenEnc = COALESCE(VALUES(tokenEnc), tokenEnc),
         secretEnc = COALESCE(VALUES(secretEnc), secretEnc),
         publicUrl = ${publicUrl === undefined ? 'publicUrl' : 'VALUES(publicUrl)'},
         updatedById = VALUES(updatedById)`,
      [
        token ? this.crypto.encrypt(token) : null,
        secret ? this.crypto.encrypt(secret) : null,
        publicUrl === undefined ? null : publicUrl || null,
        userId,
      ],
    );
    await this.reload();
    this.logger.log(
      `Telegram sozlamasi yangilandi (token: ${token ? 'ha' : 'yo‘q'}, maxfiy so‘z: ${secret ? 'yangi' : 'o‘zgarmadi'}, foydalanuvchi ${userId})`,
    );
    return {
      ...(await this.view()),
      username,
      webhookNeedsSetup: !!(token || secret || publicUrl),
    };
  }

  /** Bazadagi tokenni o‘chiradi (so‘ng .env qiymati ishlatiladi). */
  async clearToken(userId: number) {
    await this.dataSource.query(
      'UPDATE telegram_config SET tokenEnc = NULL, updatedById = ? WHERE id = 1',
      [userId],
    );
    await this.reload();
    return this.view();
  }
}
