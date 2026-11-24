import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParentNotifyService, phoneKeyOf } from './parent-notify.service';
import {
  fill,
  isParentLanguage,
  LANGUAGE_NAMES,
  PARENT_LANGUAGES,
  TEXTS,
  type ParentLanguage,
} from './parent-texts';
import { TelegramApiService, telegramConfig } from './telegram-api.service';

type Row = Record<string, unknown>;

interface TgUser {
  id: number;
  language_code?: string;
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
}
interface TgCallback {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}
export interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallback;
  my_chat_member?: {
    chat: { id: number };
    from: TgUser;
    new_chat_member: { status: string };
  };
}

const PREFS = [
  { key: 'arrival', column: 'notifyArrival' },
  { key: 'leave', column: 'notifyLeave' },
  { key: 'absent', column: 'notifyAbsent' },
  { key: 'excuse', column: 'notifyExcuse' },
] as const;

/** Telegram bot: tilni tanlash, telefon raqamini ulash, sozlamalar. Barcha xatolar ichkarida ushlanadi. */
@Injectable()
export class ParentBotService {
  private readonly logger = new Logger(ParentBotService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly telegram: TelegramApiService,
    private readonly parents: ParentNotifyService,
  ) {}

  async handle(update: TgUpdate): Promise<void> {
    try {
      if (update.my_chat_member) {
        const blocked = ['kicked', 'left'].includes(
          update.my_chat_member.new_chat_member.status,
        );
        await this.dataSource.query(
          `UPDATE parent_telegram_links SET blockedAt = ${blocked ? 'NOW(3)' : 'NULL'} WHERE telegramUserId = ?`,
          [update.my_chat_member.from.id],
        );
        return;
      }
      if (update.callback_query)
        return await this.onCallback(update.callback_query);
      if (update.message) return await this.onMessage(update.message);
    } catch (error) {
      this.logger.warn(`Bot update xatosi: ${(error as Error).message}`);
    }
  }

  private async link(userId: number): Promise<Row | null> {
    const [row]: Row[] = await this.dataSource.query(
      'SELECT * FROM parent_telegram_links WHERE telegramUserId = ?',
      [userId],
    );
    return row ?? null;
  }

  private languageOf(link: Row | null, user?: TgUser): ParentLanguage {
    if (link && isParentLanguage(link.language)) return link.language;
    const code = (user?.language_code ?? '').toLowerCase();
    if (code.startsWith('ru')) return 'ru';
    if (code.startsWith('en')) return 'en';
    if (code.startsWith('kk')) return 'kk';
    if (code.startsWith('ky')) return 'ky';
    if (code.startsWith('tg')) return 'tg';
    return 'uz';
  }

  private languageKeyboard() {
    const buttons = PARENT_LANGUAGES.map((code) => ({
      text: LANGUAGE_NAMES[code],
      callback_data: `lang:${code}`,
    }));
    const rows: (typeof buttons)[] = [];
    for (let i = 0; i < buttons.length; i += 2)
      rows.push(buttons.slice(i, i + 2));
    return { inline_keyboard: rows };
  }

  private async sendLanguagePicker(chatId: number): Promise<void> {
    await this.telegram.sendMessage(
      chatId,
      'Tilni tanlang · Выберите язык · Choose language · Тилди тандаңыз · Забонро интихоб кунед',
      { reply_markup: this.languageKeyboard() },
    );
  }

  private appButton(language: ParentLanguage) {
    const { publicUrl } = telegramConfig();
    if (!publicUrl.startsWith('https://')) return undefined;
    return {
      inline_keyboard: [
        [
          {
            text: TEXTS[language].openApp,
            web_app: { url: `${publicUrl}/parent` },
          },
        ],
      ],
    };
  }

  private prefsKeyboard(link: Row, language: ParentLanguage) {
    const t = TEXTS[language];
    return {
      inline_keyboard: PREFS.map((pref) => [
        {
          text: `${Number(link[pref.column]) === 1 ? '✅' : '⬜'} ${t[pref.key]}`,
          callback_data: `pref:${pref.key}`,
        },
      ]),
    };
  }

  private async askContact(
    chatId: number,
    language: ParentLanguage,
  ): Promise<void> {
    const t = TEXTS[language];
    await this.telegram.sendMessage(chatId, t.askContact, {
      reply_markup: {
        keyboard: [[{ text: t.shareButton, request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  private async onMessage(message: TgMessage): Promise<void> {
    if (message.chat.type !== 'private' || !message.from) return;
    const user = message.from;
    const chatId = message.chat.id;
    const link = await this.link(user.id);
    const language = this.languageOf(link, user);
    const t = TEXTS[language];

    if (message.contact) {
      // Faqat o‘z raqamini ulashishi mumkin (Telegram tasdiqlagan user_id).
      if (message.contact.user_id !== user.id) {
        await this.telegram.sendMessage(chatId, t.notYourContact);
        return;
      }
      await this.linkPhone(
        user,
        chatId,
        message.contact.phone_number,
        language,
      );
      return;
    }

    const text = (message.text ?? '').trim();
    const command = text.split(/[\s@]/)[0]?.toLowerCase() ?? '';

    if (command === '/start' || !link) {
      if (!link || command === '/start') {
        await this.sendLanguagePicker(chatId);
        return;
      }
    }
    if (command === '/lang')
      return void (await this.sendLanguagePicker(chatId));

    if (!link || link.phoneKey === null) {
      await this.telegram.sendMessage(chatId, t.needLink);
      return;
    }

    if (command === '/settings') {
      await this.telegram.sendMessage(chatId, t.settingsTitle, {
        reply_markup: this.prefsKeyboard(link, language),
      });
    } else if (command === '/app') {
      await this.telegram.sendMessage(chatId, t.openApp, {
        reply_markup: this.appButton(language),
      });
    } else if (command === '/stop') {
      await this.dataSource.query(
        'UPDATE parent_telegram_links SET notifyArrival = 0, notifyLeave = 0, notifyAbsent = 0, notifyExcuse = 0 WHERE id = ?',
        [Number(link.id)],
      );
      await this.telegram.sendMessage(chatId, t.help);
    } else {
      await this.telegram.sendMessage(chatId, t.help);
    }
  }

  private async linkPhone(
    user: TgUser,
    chatId: number,
    phone: string,
    language: ParentLanguage,
  ): Promise<void> {
    const t = TEXTS[language];
    const key = phoneKeyOf(phone);
    const children = key ? await this.parents.childrenOf(key) : [];
    if (!key || children.length === 0) {
      await this.telegram.sendMessage(chatId, t.notFound, {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }
    await this.dataSource.query(
      `INSERT INTO parent_telegram_links (telegramUserId, chatId, phoneKey, language)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE chatId = VALUES(chatId), phoneKey = VALUES(phoneKey), blockedAt = NULL`,
      [user.id, chatId, key, language],
    );
    const list = children
      .map(
        (child) =>
          `• ${child.lastName} ${child.firstName}${child.className ? ` (${child.className})` : ''}`,
      )
      .join('\n');
    await this.telegram.sendMessage(
      chatId,
      fill(t.linked, { children: list }),
      {
        reply_markup: this.appButton(language) ?? { remove_keyboard: true },
      },
    );
  }

  private async onCallback(callback: TgCallback): Promise<void> {
    const chatId = callback.message?.chat.id;
    const data = callback.data ?? '';
    if (!chatId) return;
    const answer = () =>
      this.telegram
        .call('answerCallbackQuery', { callback_query_id: callback.id })
        .catch(() => undefined);

    if (data.startsWith('lang:')) {
      const code = data.slice(5);
      if (!isParentLanguage(code)) return void (await answer());
      await this.dataSource.query(
        `INSERT INTO parent_telegram_links (telegramUserId, chatId, language) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE chatId = VALUES(chatId), language = VALUES(language), blockedAt = NULL`,
        [callback.from.id, chatId, code],
      );
      await answer();
      const link = await this.link(callback.from.id);
      if (link?.phoneKey) {
        await this.telegram.sendMessage(chatId, TEXTS[code].langChanged, {
          reply_markup: this.appButton(code),
        });
      } else {
        await this.askContact(chatId, code);
      }
      return;
    }

    if (data.startsWith('pref:')) {
      const link = await this.link(callback.from.id);
      const pref = PREFS.find((item) => item.key === data.slice(5));
      if (!link || !pref) return void (await answer());
      const next = Number(link[pref.column]) === 1 ? 0 : 1;
      await this.dataSource.query(
        `UPDATE parent_telegram_links SET ${pref.column} = ? WHERE id = ?`,
        [next, Number(link.id)],
      );
      const fresh = (await this.link(callback.from.id)) ?? link;
      await answer();
      if (callback.message) {
        await this.telegram
          .call('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: callback.message.message_id,
            reply_markup: this.prefsKeyboard(
              fresh,
              this.languageOf(fresh, callback.from),
            ),
          })
          .catch(() => undefined);
      }
      return;
    }
    await answer();
  }
}
