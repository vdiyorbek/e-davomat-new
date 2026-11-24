import { Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

/** Bazadan o‘qilgan sozlama (TelegramConfigService to‘ldiradi). Bo‘sh maydon bo‘lsa .env ishlatiladi. */
export interface StoredTelegramConfig {
  token: string;
  secret: string;
  publicUrl: string;
}
let stored: StoredTelegramConfig = { token: '', secret: '', publicUrl: '' };

export function setStoredTelegramConfig(value: StoredTelegramConfig): void {
  stored = value;
}

export function telegramConfig() {
  return {
    token: stored.token || (process.env.TELEGRAM_BOT_TOKEN ?? ''),
    secret: stored.secret || (process.env.TELEGRAM_WEBHOOK_SECRET ?? ''),
    apiBase: (
      process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'
    ).replace(/\/$/, ''),
    publicUrl: (
      stored.publicUrl ||
      (process.env.PUBLIC_BASE_URL ?? '')
    ).replace(/\/$/, ''),
  };
}

/** Telegram Bot API (tashqi HTTP). Token bazadan (shifrlangan) yoki .env'dan olinadi va hech qayerga chiqarilmaydi. */
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);

  get configured(): boolean {
    const config = telegramConfig();
    return config.token !== '' && config.secret.length >= 16;
  }

  async call<T = unknown>(
    method: string,
    body: Record<string, unknown> | FormData = {},
  ): Promise<T> {
    const { token, apiBase } = telegramConfig();
    if (!token)
      throw new TelegramError('Telegram bot tokeni sozlanmagan', null);
    try {
      const { data } = await axios.post<{
        ok: boolean;
        result: T;
        description?: string;
        error_code?: number;
        parameters?: { retry_after?: number };
      }>(`${apiBase}/bot${token}/${method}`, body, {
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (!data.ok) {
        throw new TelegramError(
          String(data.description ?? 'Telegram xatosi').slice(0, 200),
          data.error_code ?? null,
          data.parameters?.retry_after ?? null,
        );
      }
      return data.result;
    } catch (error) {
      if (error instanceof TelegramError) throw error;
      const message = isAxiosError(error)
        ? (error.code ?? error.message)
        : (error as Error).message;
      this.logger.warn(`Telegram ${method}: ${message}`);
      throw new TelegramError(
        `Telegramga ulanib bo‘lmadi: ${String(message).slice(0, 120)}`,
        null,
      );
    }
  }

  sendMessage(
    chatId: number | string,
    text: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    });
  }

  /** Rasm + izoh (JPEG baytlari to‘g‘ridan-to‘g‘ri yuklanadi). */
  sendPhoto(chatId: number | string, photo: Buffer, caption: string) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append(
      'photo',
      new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }),
      'photo.jpg',
    );
    return this.call('sendPhoto', form);
  }
}
