import i18n from '@/i18n';

/** Tizimdagi barcha sana va vaqtlar Toshkent vaqti bo‘yicha hisoblanadi. */
export const APP_TIME_ZONE = 'Asia/Tashkent';

function tashkentParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';

    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
    };
}

/** Bugungi sana `YYYY-MM-DD` ko‘rinishida (Toshkent vaqti). */
export function todayInTashkent(): string {
    const { year, month, day } = tashkentParts(new Date());
    return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` sanaga kun qo‘shadi (manfiy ham bo‘lishi mumkin). */
export function addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/** O‘quv yili sentyabrdan boshlanadi: 2025-10-01 → "2025-2026". */
export function academicYearFor(isoDate: string): string {
    const year = Number(isoDate.slice(0, 4));
    const month = Number(isoDate.slice(5, 7));
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Sanani `KK.OO.YYYY` ko‘rinishida chiqaradi.
 * Bo‘sh qiymat uchun `fallback` (standart: «Belgilanmagan») qaytaradi.
 */
export function formatDate(
    value: string | null | undefined,
    fallback = i18n.t('common.notSet'),
): string {
    if (!value) return fallback;

    const match = ISO_DATE.exec(value);
    if (match && value.length <= 10) {
        return `${match[3]}.${match[2]}.${match[1]}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const { year, month, day } = tashkentParts(date);
    return `${day}.${month}.${year}`;
}

/** Vaqtni `SS:DD` ko‘rinishida chiqaradi (Toshkent vaqti). */
export function formatTime(value: string | null | undefined, fallback = '—'): string {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const { hour, minute } = tashkentParts(date);
    return `${hour}:${minute}`;
}

/** Sana va vaqt: `KK.OO.YYYY, SS:DD`. */
export function formatDateTime(value: string | null | undefined, fallback = '—'): string {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const { year, month, day, hour, minute } = tashkentParts(date);
    return `${day}.${month}.${year}, ${hour}:${minute}`;
}

/** Hafta kuni nomi, tanlangan tilda. 0 = dushanba … 6 = yakshanba. */
export function weekdayName(index: number, variant: 'short' | 'long' = 'long'): string {
    return i18n.t(`date.weekdays.${variant}.${index}`);
}

/** `YYYY-MM-DD` uchun hafta kuni indeksi (0 = dushanba). */
export function weekdayIndex(isoDate: string): number {
    const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    return (day + 6) % 7;
}

/** Oy nomi, tanlangan tilda. 1 = yanvar … 12 = dekabr. */
export function monthName(month: number): string {
    return i18n.t(`date.months.${month}`);
}

/** «19-oktabr, 2026» kabi uzun sana — tilga mos shaklda. */
export function formatDateLong(isoDate: string | null | undefined): string {
    if (!isoDate) return i18n.t('common.notSet');

    const match = ISO_DATE.exec(isoDate);
    if (!match) return isoDate;

    return i18n.t('date.long', {
        day: Number(match[3]),
        month: i18n.t(`date.monthsGenitive.${Number(match[2])}`),
        year: match[1],
        weekday: weekdayName(weekdayIndex(isoDate.slice(0, 10))),
    });
}

/** Raqamlarni tanlangan tilga mos guruhlab chiqaradi: 12 345. */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat('ru-RU').format(value);
}

/** Joriy o‘quv yili atrofidagi yillar ro‘yxati: [o‘tgan, joriy, keyingi]. */
export function academicYearOptions(extra?: string | null): string[] {
    const current = Number(academicYearFor(todayInTashkent()).slice(0, 4));
    const years = [current - 1, current, current + 1].map((from) => `${from}-${from + 1}`);
    if (extra && /^\d{4}-\d{4}$/.test(extra) && !years.includes(extra)) years.push(extra);
    return years.sort();
}

export const ACADEMIC_YEAR_PATTERN = /^[1-9][0-9]{3}-[1-9][0-9]{3}$/;

export function isValidAcademicYear(value: string): boolean {
    if (!ACADEMIC_YEAR_PATTERN.test(value)) return false;
    const [from, to] = value.split('-').map(Number);
    return to === from + 1;
}
