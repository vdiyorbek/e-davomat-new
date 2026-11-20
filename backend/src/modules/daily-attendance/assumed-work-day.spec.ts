import { assumeWorkDay } from './assumed-work-day';

describe('Faraz qilingan o‘quv kuni', () => {
  it('sozlanmagan kun, maktabda kelganlar bor → o‘quv kuni', () => {
    expect(assumeWorkDay('UNCONFIGURED', '2026-11-19', true)).toEqual({
      state: 'WORK_DAY',
      assumed: true,
    });
  });

  it('hech kim kelmagan bo‘lsa (terminal ishlamagan) o‘zgarmaydi', () => {
    expect(assumeWorkDay('UNCONFIGURED', '2026-11-19', false)).toEqual({
      state: 'UNCONFIGURED',
      assumed: false,
    });
  });

  it('yakshanba o‘quv kuni deb faraz qilinmaydi', () => {
    expect(assumeWorkDay('UNCONFIGURED', '2026-11-15', true).state).toBe(
      'UNCONFIGURED',
    );
  });

  it('aniq holatlar (o‘quv kuni, dam olish, ziddiyat) o‘zgarmaydi', () => {
    for (const state of ['WORK_DAY', 'DAY_OFF', 'CONFLICT'] as const) {
      expect(assumeWorkDay(state, '2026-11-19', true)).toEqual({
        state,
        assumed: false,
      });
    }
  });
});
