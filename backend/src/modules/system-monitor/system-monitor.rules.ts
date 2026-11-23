import type { CheckStatus } from './system-monitor.types';

/** Pastroqqa yomonlashadigan qiymat: [warn, crit] chegaralari «katta = yomon». */
export function byHigh(value: number, warn: number, crit: number): CheckStatus {
  if (value >= crit) return 'crit';
  if (value >= warn) return 'warn';
  return 'ok';
}

/** «Kichik = yomon» (masalan, bo‘sh joy foizi). */
export function byLow(value: number, warn: number, crit: number): CheckStatus {
  if (value <= crit) return 'crit';
  if (value <= warn) return 'warn';
  return 'ok';
}

/** Toshkent vaqti bo‘yicha: dushanba–shanba, soat [from, to). */
export function isWorkTime(
  now: Date,
  fromHour: number,
  toHour: number,
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return weekday !== 'Sun' && hour >= fromHour && hour < toHour;
}

/** Ma’lumot yangiligi (daqiqada): tun/dam olishda tekshirilmaydi. */
export function freshnessStatus(
  ageMinutes: number | null,
  warn: number,
  crit: number,
  checkedNow: boolean,
): CheckStatus {
  if (!checkedNow) return 'ok';
  if (ageMinutes === null) return 'crit';
  return byHigh(ageMinutes, warn, crit);
}
