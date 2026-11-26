import type { ParentLanguage } from './parent-texts';

export const BROADCAST_TYPES = [
  'ANNOUNCEMENT',
  'URGENT',
  'REMINDER',
  'CONGRATS',
  'INFO',
] as const;
export type BroadcastType = (typeof BROADCAST_TYPES)[number];

export function isBroadcastType(value: unknown): value is BroadcastType {
  return (
    typeof value === 'string' &&
    (BROADCAST_TYPES as readonly string[]).includes(value)
  );
}

/** Xabar sarlavhasi: belgi + tilga mos tur nomi. */
export const BROADCAST_HEADS: Record<
  ParentLanguage,
  Record<BroadcastType, string>
> = {
  uz: {
    ANNOUNCEMENT: '📢 <b>E’lon</b>',
    URGENT: '🚨 <b>Muhim xabar</b>',
    REMINDER: '⏰ <b>Eslatma</b>',
    CONGRATS: '🎉 <b>Tabrik</b>',
    INFO: 'ℹ️ <b>Ma’lumot</b>',
  },
  'uz-Cyrl': {
    ANNOUNCEMENT: '📢 <b>Эълон</b>',
    URGENT: '🚨 <b>Муҳим хабар</b>',
    REMINDER: '⏰ <b>Эслатма</b>',
    CONGRATS: '🎉 <b>Табрик</b>',
    INFO: 'ℹ️ <b>Маълумот</b>',
  },
  ru: {
    ANNOUNCEMENT: '📢 <b>Объявление</b>',
    URGENT: '🚨 <b>Важное сообщение</b>',
    REMINDER: '⏰ <b>Напоминание</b>',
    CONGRATS: '🎉 <b>Поздравление</b>',
    INFO: 'ℹ️ <b>Информация</b>',
  },
  en: {
    ANNOUNCEMENT: '📢 <b>Announcement</b>',
    URGENT: '🚨 <b>Important notice</b>',
    REMINDER: '⏰ <b>Reminder</b>',
    CONGRATS: '🎉 <b>Congratulations</b>',
    INFO: 'ℹ️ <b>Information</b>',
  },
  kk: {
    ANNOUNCEMENT: '📢 <b>Хабарландыру</b>',
    URGENT: '🚨 <b>Маңызды хабар</b>',
    REMINDER: '⏰ <b>Еске салу</b>',
    CONGRATS: '🎉 <b>Құттықтау</b>',
    INFO: 'ℹ️ <b>Ақпарат</b>',
  },
  ky: {
    ANNOUNCEMENT: '📢 <b>Жарыя</b>',
    URGENT: '🚨 <b>Маанилүү билдирүү</b>',
    REMINDER: '⏰ <b>Эскертме</b>',
    CONGRATS: '🎉 <b>Куттуктоо</b>',
    INFO: 'ℹ️ <b>Маалымат</b>',
  },
  tg: {
    ANNOUNCEMENT: '📢 <b>Эълон</b>',
    URGENT: '🚨 <b>Хабари муҳим</b>',
    REMINDER: '⏰ <b>Ёдрасонӣ</b>',
    CONGRATS: '🎉 <b>Табрик</b>',
    INFO: 'ℹ️ <b>Маълумот</b>',
  },
};

/** Telegram HTML rejimi uchun: administrator yozgan matn belgilari xavfsizlantiriladi. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface BroadcastTexts {
  [language: string]: { title?: string; body?: string } | undefined;
}

/** Ota-ona tiliga mos xabar; tilda matn bo‘lmasa — o‘zbekcha. */
export function composeBroadcast(
  language: ParentLanguage,
  type: string,
  texts: BroadcastTexts,
): string {
  const heads = BROADCAST_HEADS[language];
  const head = isBroadcastType(type)
    ? heads[type]
    : BROADCAST_HEADS.uz.ANNOUNCEMENT;
  const own = texts[language];
  const chosen = own?.body?.trim() ? own : texts.uz;
  const title = chosen?.title?.trim();
  const body = chosen?.body?.trim() ?? '';
  return (
    `${head}\n\n` +
    (title ? `<b>${escapeHtml(title)}</b>\n\n` : '') +
    escapeHtml(body)
  );
}
