import {
  defaultWeekDays,
  isDefaultWorkDay,
  type DefaultWeekConfig,
} from './default-week';

const config: DefaultWeekConfig = {
  primaryMaxGrade: 4,
  primaryDays: 5,
  generalDays: 6,
};

describe('Standart o‘quv haftasi', () => {
  it('1–4 sinf o‘quvchisi: 5 kun, 5–11 sinf: 6 kun', () => {
    for (const grade of [1, 2, 3, 4]) {
      expect(defaultWeekDays(config, { isStudent: true, grade })).toBe(5);
    }
    for (const grade of [5, 6, 9, 11]) {
      expect(defaultWeekDays(config, { isStudent: true, grade })).toBe(6);
    }
  });

  it('sinf darajasi noma’lum o‘quvchi — umumiy hafta', () => {
    expect(defaultWeekDays(config, { isStudent: true, grade: null })).toBe(6);
  });

  it('shanba: 4-sinf dam oladi, 5-sinf o‘qiydi; yakshanba hammaga dam', () => {
    const saturday = 5;
    const sunday = 6;
    expect(
      isDefaultWorkDay(config, { isStudent: true, grade: 4 }, saturday),
    ).toBe(false);
    expect(
      isDefaultWorkDay(config, { isStudent: true, grade: 5 }, saturday),
    ).toBe(true);
    expect(
      isDefaultWorkDay(config, { isStudent: true, grade: 5 }, sunday),
    ).toBe(false);
    expect(isDefaultWorkDay(config, { isStudent: true, grade: 1 }, 4)).toBe(
      true,
    );
  });

  it('o‘qituvchi: faqat boshlang‘ich sinflarda dars bersa 5 kun, aks holda 6', () => {
    expect(
      defaultWeekDays(config, { isStudent: false, primaryOnly: true }),
    ).toBe(5);
    expect(
      defaultWeekDays(config, { isStudent: false, primaryOnly: false }),
    ).toBe(6);
    expect(defaultWeekDays(config, { isStudent: false })).toBe(6);
  });

  it('sozlamani o‘zgartirsa qoida ham o‘zgaradi', () => {
    const custom = { primaryMaxGrade: 3, primaryDays: 5, generalDays: 5 };
    expect(defaultWeekDays(custom, { isStudent: true, grade: 4 })).toBe(5);
    expect(isDefaultWorkDay(custom, { isStudent: true, grade: 8 }, 5)).toBe(
      false,
    );
  });
});
