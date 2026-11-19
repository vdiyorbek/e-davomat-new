import type { AttendanceCalendarState } from '../attendance-calendar/calendar-resolver.service';

export type EffectiveDayState = 'WORK_DAY' | 'DAY_OFF' | 'UNKNOWN';

/** Shuncha o‘quv kuni ketma-ket sababsiz kelmasa — «e’tibor talab qiladi». */
export const ABSENCE_STREAK_DAYS = 5;

/** «HH:MM» yoki «HH:MM:SS» → kun boshidan daqiqa. */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** UTC vaqtdagi kelish → Toshkent (UTC+5) bo‘yicha kun boshidan daqiqa. */
export function tashkentMinutes(at: Date): number {
  return (at.getUTCHours() * 60 + at.getUTCMinutes() + 5 * 60) % (24 * 60);
}

/**
 * Kechikkanmi: kelish vaqti dars (smena) boshlanishidan maktab belgilagan
 * chegaradan ko‘proq keyin. Boshlanish vaqti noma’lum bo‘lsa — baholanmaydi.
 */
export function isLate(
  firstIn: Date | null,
  expectedStart: string | null,
  thresholdMinutes: number,
): boolean | null {
  if (!firstIn || !expectedStart) return null;
  return (
    tashkentMinutes(firstIn) > timeToMinutes(expectedStart) + thresholdMinutes
  );
}

/**
 * Kalendar holatidan hisobotda ishlatiladigan holat. Kalendar sozlanmagan
 * maktabda dashboard bo‘sh qolmasligi uchun: yakshanba bo‘lmasa va o‘sha kuni
 * maktabda kamida bitta kishi kelgan bo‘lsa, o‘quv kuni deb FARAZ qilinadi
 * (alohida sanaladi va ogohlantirish chiqadi).
 */
export function effectiveState(
  state: AttendanceCalendarState,
  date: string,
  hasData: boolean,
): { state: EffectiveDayState; assumed: boolean } {
  if (state === 'WORK_DAY') return { state: 'WORK_DAY', assumed: false };
  if (state === 'DAY_OFF') return { state: 'DAY_OFF', assumed: false };

  const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  return hasData && !sunday
    ? { state: 'WORK_DAY', assumed: true }
    : { state: 'UNKNOWN', assumed: false };
}

export interface StreakDay {
  date: string;
  present: boolean;
  excused: boolean;
}

/**
 * Oxirgi o‘quv kunlaridan boshlab ortga sababsiz kelmagan kunlar soni.
 * `days` — faqat shu sinf uchun o‘quv kuni bo‘lgan va maktabda ma’lumot
 * kelgan sanalar (dam olish, bayram va terminal ishlamagan kunlar kirmaydi),
 * eng yangisidan eskisiga tartiblangan.
 */
export function absenceStreak(days: StreakDay[]): {
  days: number;
  sinceDate: string | null;
} {
  let count = 0;
  let sinceDate: string | null = null;

  for (const day of days) {
    if (day.present || day.excused) break;
    count++;
    sinceDate = day.date;
  }

  return { days: count, sinceDate };
}

/** Sababli kelmaganlar hisobdan chiqariladi: kelgan / (kutilgan − sababli). */
export function attendanceRate(
  expected: number,
  present: number,
  excused: number,
): number | null {
  const base = expected - excused;
  return base > 0 ? Math.round((present / base) * 1000) / 10 : null;
}
