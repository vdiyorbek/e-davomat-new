/** Mahalla uchastkavoyi moduli uchun sof qoidalar (DB'siz, unit testlanadi). */

export type InspectorDayStatus =
  'PRESENT' | 'EXCUSED' | 'ABSENT' | 'PENDING' | 'DAY_OFF';

export const DAY_STATUSES: InspectorDayStatus[] = [
  'PRESENT',
  'EXCUSED',
  'ABSENT',
  'DAY_OFF',
];

export interface DayStatusInput {
  /** Kalendar bo'yicha o'quv kunimi */
  workDay: boolean;
  /** Shu kunni qoplaydigan faol sababnoma bormi */
  excused: boolean;
  /** Birinchi kirish (turniket) */
  firstIn: Date | null;
}

export function dayStatus(input: DayStatusInput): InspectorDayStatus {
  if (input.firstIn) return 'PRESENT';
  if (input.excused) return 'EXCUSED';
  if (!input.workDay) return 'DAY_OFF';
  return 'ABSENT';
}

/** Suhbatni yozgan uchastkavoy uni shu muddat ichida tahrirlay yoki o'chira oladi. */
export const TALK_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canModifyTalk(
  createdAt: Date,
  now: Date = new Date(),
): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= TALK_EDIT_WINDOW_MS;
}

/** Bitta uchastkavoyga ko'pi bilan shuncha mahalla biriktiriladi. */
export const MAX_MAHALLAS_PER_INSPECTOR = 30;

/** Takrorlarni olib tashlaydi, musbat butun sonlarni qoldiradi, tartiblaydi. */
export function normalizeIds(ids: unknown[]): number[] {
  const out = new Set<number>();
  for (const v of ids) {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n === 'number' && Number.isInteger(n) && n > 0) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Suhbat sanasi (YYYY-MM-DD): kelajakda emas va 1 yildan eski emas. */
export function talkDateValid(talkDate: string, today: string): boolean {
  if (talkDate > today) return false;
  const year = Number(today.slice(0, 4)) - 1;
  return talkDate >= `${year}${today.slice(4)}`;
}

/** Keyingi nazorat sanasi suhbatdan keyin va 6 oydan oshmasligi kerak. */
export function followUpValid(talkDate: string, followUp: string): boolean {
  if (followUp <= talkDate) return false;
  const limit = new Date(`${talkDate}T00:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + 6);
  return followUp <= limit.toISOString().slice(0, 10);
}

/** Ro'yxatni holat bo'yicha sanaydi. */
export function countStatuses(
  statuses: InspectorDayStatus[],
): Record<InspectorDayStatus, number> {
  const out = Object.fromEntries(DAY_STATUSES.map((s) => [s, 0])) as Record<
    InspectorDayStatus,
    number
  >;
  for (const s of statuses) out[s]++;
  return out;
}

/** "Kelmagan" deb hisoblash boshlanadigan vaqt (hozircha barcha maktablar uchun bir xil). */
export const DEFAULT_ABSENT_CHECK_TIME = '09:00';

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Toshkent vaqti bo'yicha sana, YYYY-MM-DD. */
export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** Toshkent vaqti bo'yicha soat, HH:mm. */
export function tashkentTime(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS)
    .toISOString()
    .slice(11, 16);
}
