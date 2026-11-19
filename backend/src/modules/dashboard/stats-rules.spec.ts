import {
  absenceStreak,
  attendanceRate,
  effectiveState,
  isLate,
  tashkentMinutes,
} from './stats-rules';

describe('Dashboard qoidalari', () => {
  it('UTC vaqtni Toshkent daqiqasiga o‘giradi', () => {
    expect(tashkentMinutes(new Date('2026-11-18T03:04:00Z'))).toBe(8 * 60 + 4);
    expect(tashkentMinutes(new Date('2026-11-18T20:30:00Z'))).toBe(1 * 60 + 30);
  });

  it('kechikishni maktab chegarasi bilan baholaydi', () => {
    const at = (hhmm: string) => new Date(`2026-11-18T${hhmm}:00+05:00`);
    expect(isLate(at('08:05'), '08:00:00', 5)).toBe(false); // aynan chegarada — kechikmagan
    expect(isLate(at('08:06'), '08:00:00', 5)).toBe(true);
    expect(isLate(at('08:06'), '08:00', 10)).toBe(false);
    expect(isLate(at('13:40'), '13:30', 5)).toBe(true); // 2-smena
    expect(isLate(null, '08:00', 5)).toBeNull();
    expect(isLate(at('09:00'), null, 5)).toBeNull(); // smena/dars noma’lum — baholanmaydi
  });

  it('sozlanmagan kalendarda faqat ma’lumot bo‘lsa va yakshanba bo‘lmasa o‘quv kuni deb faraz qiladi', () => {
    expect(effectiveState('WORK_DAY', '2026-11-22', false)).toEqual({
      state: 'WORK_DAY',
      assumed: false,
    });
    expect(effectiveState('DAY_OFF', '2026-11-18', true)).toEqual({
      state: 'DAY_OFF',
      assumed: false,
    });
    expect(effectiveState('UNCONFIGURED', '2026-11-18', true)).toEqual({
      state: 'WORK_DAY',
      assumed: true,
    });
    expect(effectiveState('UNCONFIGURED', '2026-11-18', false).state).toBe(
      'UNKNOWN',
    );
    expect(effectiveState('UNCONFIGURED', '2026-11-22', true).state).toBe(
      'UNKNOWN',
    ); // yakshanba
  });

  it('ketma-ketlikni eng yangi o‘quv kunidan ortga sanaydi', () => {
    const absent = (date: string) => ({ date, present: false, excused: false });
    expect(
      absenceStreak([
        absent('2026-11-20'),
        absent('2026-11-19'),
        { date: '2026-11-18', present: false, excused: true },
        absent('2026-11-17'),
      ]),
    ).toEqual({ days: 2, sinceDate: '2026-11-19' });
    expect(
      absenceStreak([{ date: '2026-11-20', present: true, excused: false }]),
    ).toEqual({
      days: 0,
      sinceDate: null,
    });
  });

  it('sababli kelmaganlarni foiz hisobidan chiqaradi', () => {
    expect(attendanceRate(100, 90, 5)).toBe(94.7);
    expect(attendanceRate(10, 0, 10)).toBeNull();
    expect(attendanceRate(0, 0, 0)).toBeNull();
  });
});
