import type { AttendanceCalendarState } from '../attendance-calendar/calendar-resolver.service';

/**
 * Kalendar sozlanmagan (UNCONFIGURED) kun: maktabda shu kuni kamida bitta kishi kelgan
 * (terminal ishlayapti) va kun yakshanba emas bo‘lsa — o‘quv kuni deb FARAZ qilinadi,
 * shunda kelmaganlar «Jadval sozlanmagan» emas, «Kelmagan» bo‘ladi.
 * Dashboard ham aynan shu qoidani ishlatadi. DAY_OFF va CONFLICT o‘zgarmaydi.
 */
export function assumeWorkDay(
  state: AttendanceCalendarState,
  date: string,
  schoolHasArrivals: boolean,
): { state: AttendanceCalendarState; assumed: boolean } {
  if (state !== 'UNCONFIGURED' || !schoolHasArrivals) {
    return { state, assumed: false };
  }
  const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  return sunday
    ? { state, assumed: false }
    : { state: 'WORK_DAY', assumed: true };
}
