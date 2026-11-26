import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { PersonPhotosService } from '../persons/person-photos.service';

import { TelegramApiService, TelegramError } from './telegram-api.service';
import { INTERNAL_USER } from './internal-user';
import { fill, isParentLanguage, niceName, TEXTS } from './parent-texts';
import { composeBroadcast } from './parent-broadcast-texts';
import type { BroadcastTexts } from './parent-broadcast-texts';
import type { ParentLanguage } from './parent-texts';
import { str } from './str';

type Row = Record<string, unknown>;

const BATCH = 100;
const PAUSE_MS = 40; // ~25 xabar/soniya (Telegram chegarasidan past)
const MAX_ATTEMPTS = 5;

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Navbatdagi xabarlarni Telegramga yuboradi. */
@Injectable()
export class ParentSenderService {
  private readonly logger = new Logger(ParentSenderService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly telegram: TelegramApiService,
    private readonly photos: PersonPhotosService,
  ) {}

  private compose(
    kind: string,
    language: ParentLanguage,
    payload: Record<string, unknown>,
  ): string {
    const t = TEXTS[language];
    const name = niceName(str(payload.name ?? ''));
    switch (kind) {
      case 'ARRIVED':
        return fill(t.arrived, { name, time: str(payload.time ?? '') });
      case 'LEFT':
        return fill(t.left, { name, time: str(payload.time ?? '') });
      case 'ABSENT':
        return fill(t.absentMsg, { name, start: str(payload.start ?? '') });
      default: {
        const approved = Number(payload.approved) === 1;
        const reason =
          !approved &&
          typeof payload.reason === 'string' &&
          payload.reason !== ''
            ? fill(t.reason, { text: payload.reason })
            : '';
        return fill(
          approved ? t.excuseApproved : t.excuseRejected,
          {
            name,
            from: formatDay(str(payload.from ?? '')),
            to: formatDay(str(payload.to ?? '')),
            reason,
          },
          ['reason'],
        );
      }
    }
  }

  /** Farzand rasmi bo‘lsa — baytlari, yo‘q bo‘lsa yoki o‘qib bo‘lmasa null. */
  private async photoOf(personId: number): Promise<Buffer | null> {
    try {
      return await this.photos.read(personId, INTERNAL_USER);
    } catch {
      return null;
    }
  }

  /** Shu partiyadagi ommaviy xabarlarning matni (bir marta o‘qiladi). */
  private async loadBroadcasts(
    rows: Row[],
  ): Promise<
    Map<number, { type: string; texts: BroadcastTexts; canceled: boolean }>
  > {
    const ids = new Set<number>();
    for (const row of rows) {
      if (str(row.kind) !== 'BROADCAST') continue;
      const payload =
        typeof row.payload === 'string'
          ? (JSON.parse(row.payload) as Record<string, unknown>)
          : ((row.payload as Record<string, unknown> | null) ?? {});
      ids.add(Number(payload.broadcastId));
    }
    const result = new Map<
      number,
      { type: string; texts: BroadcastTexts; canceled: boolean }
    >();
    if (ids.size === 0) return result;
    const found: Row[] = await this.dataSource.query(
      'SELECT id, type, texts, canceledAt FROM parent_broadcasts WHERE id IN (?)',
      [[...ids]],
    );
    for (const item of found) {
      result.set(Number(item.id), {
        type: str(item.type),
        texts: (typeof item.texts === 'string'
          ? JSON.parse(item.texts)
          : item.texts) as BroadcastTexts,
        canceled: item.canceledAt !== null,
      });
    }
    return result;
  }

  @Cron('*/5 * * * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (this.running || !this.telegram.configured) return;
    this.running = true;
    try {
      const select = `SELECT m.id, m.kind, m.personId, m.payload, m.attempts, l.id AS linkId, l.chatId, l.language
           FROM parent_messages m JOIN parent_telegram_links l ON l.id = m.linkId
          WHERE m.status = 'PENDING' AND m.sendAfter <= NOW(3)`;
      // Davomat xabarlari (keldi/ketdi/kelmadi) hamisha birinchi: ommaviy e‘lon ularni kutdirmaydi.
      const rows: Row[] = await this.dataSource.query(
        `${select} AND m.kind <> 'BROADCAST' ORDER BY m.id ASC LIMIT ${BATCH}`,
      );
      if (rows.length < BATCH) {
        const broadcastRows: Row[] = await this.dataSource.query(
          `${select} AND m.kind = 'BROADCAST' ORDER BY m.id ASC LIMIT ${BATCH - rows.length}`,
        );
        rows.push(...broadcastRows);
      }
      const broadcasts = await this.loadBroadcasts(rows);
      for (const row of rows) {
        const id = Number(row.id);
        const payload =
          typeof row.payload === 'string'
            ? (JSON.parse(row.payload) as Record<string, unknown>)
            : ((row.payload as Record<string, unknown> | null) ?? {});
        const language = isParentLanguage(row.language) ? row.language : 'uz';
        try {
          const kind = str(row.kind);
          if (kind === 'BROADCAST') {
            const broadcast = broadcasts.get(Number(payload.broadcastId));
            if (!broadcast || broadcast.canceled) {
              await this.dataSource.query(
                "UPDATE parent_messages SET status = 'SKIPPED', error = 'bekor qilindi' WHERE id = ?",
                [id],
              );
              continue;
            }
            await this.telegram.sendMessage(
              str(row.chatId),
              composeBroadcast(language, broadcast.type, broadcast.texts),
            );
            await this.dataSource.query(
              "UPDATE parent_messages SET status = 'SENT', sentAt = NOW(3), attempts = attempts + 1, error = NULL WHERE id = ?",
              [id],
            );
            await new Promise<void>((resolve) => setTimeout(resolve, PAUSE_MS));
            continue;
          }
          const text = this.compose(kind, language, payload);
          const photo =
            kind === 'ARRIVED' || kind === 'LEFT' || kind === 'ABSENT'
              ? await this.photoOf(Number(row.personId))
              : null;
          let sentWithPhoto = false;
          if (photo) {
            try {
              await this.telegram.sendPhoto(str(row.chatId), photo, text);
              sentWithPhoto = true;
            } catch (photoError) {
              // Rasm bilan bo‘lmadi (masalan, fayl muammosi): oddiy matn yuboriladi.
              // Bot bloklangan bo‘lsa, matn yuborishda xuddi shu xato qayta chiqadi va quyida hal qilinadi.
              if (
                photoError instanceof TelegramError &&
                photoError.code === 429
              )
                throw photoError;
            }
          }
          if (!sentWithPhoto)
            await this.telegram.sendMessage(str(row.chatId), text);
          await this.dataSource.query(
            "UPDATE parent_messages SET status = 'SENT', sentAt = NOW(3), attempts = attempts + 1, error = NULL WHERE id = ?",
            [id],
          );
        } catch (error) {
          const failure =
            error instanceof TelegramError
              ? error
              : new TelegramError(String(error), null);
          if (failure.code === 429) {
            await this.dataSource.query(
              'UPDATE parent_messages SET sendAfter = DATE_ADD(NOW(3), INTERVAL ? SECOND) WHERE id = ?',
              [failure.retryAfter ?? 5, id],
            );
            break; // umumiy chegaraga yetdik — keyingi tickda
          }
          if (failure.code === 403 || failure.code === 400) {
            // Bot bloklangan yoki chat yo‘q: akkaunt «bloklangan» deb belgilanadi, xabar o‘tkazib yuboriladi.
            await this.dataSource.query(
              'UPDATE parent_telegram_links SET blockedAt = NOW(3) WHERE id = ?',
              [Number(row.linkId)],
            );
            await this.dataSource.query(
              "UPDATE parent_messages SET status = 'SKIPPED', error = ? WHERE id = ?",
              [failure.message.slice(0, 190), id],
            );
          } else {
            const attempts = Number(row.attempts) + 1;
            await this.dataSource.query(
              `UPDATE parent_messages
                  SET attempts = ?, error = ?, status = ?, sendAfter = DATE_ADD(NOW(3), INTERVAL ? SECOND)
                WHERE id = ?`,
              [
                attempts,
                failure.message.slice(0, 190),
                attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                60 * attempts,
                id,
              ],
            );
          }
        }
        await new Promise<void>((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    } catch (error) {
      this.logger.error(`Xabar yuborish tsikli: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
