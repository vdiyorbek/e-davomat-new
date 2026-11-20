import { findSetting, parseSettingValue, SETTINGS } from './settings.registry';

describe('Tizim sozlamalari ro‘yxati', () => {
  it('kalitlar takrorlanmaydi va standart qiymat chegarada', () => {
    const keys = new Set(SETTINGS.map((setting) => setting.key));
    expect(keys.size).toBe(SETTINGS.length);
    for (const setting of SETTINGS) {
      expect(parseSettingValue(setting, setting.getDefault())).toBe(
        setting.getDefault(),
      );
    }
  });

  it('son chegaradan chiqsa yoki butun bo‘lmasa rad etiladi', () => {
    const concurrency = findSetting('photosConcurrency')!;
    expect(parseSettingValue(concurrency, 3)).toBe(3);
    expect(parseSettingValue(concurrency, '4')).toBe(4);
    expect(parseSettingValue(concurrency, 0)).toBeNull();
    expect(parseSettingValue(concurrency, 7)).toBeNull();
    expect(parseSettingValue(concurrency, 2.5)).toBeNull();
    expect(parseSettingValue(concurrency, 'abc')).toBeNull();
    expect(parseSettingValue(concurrency, '')).toBeNull();
    expect(parseSettingValue(concurrency, null)).toBeNull();
  });

  it('mantiqiy qiymatlar', () => {
    const toggle = findSetting('pushLagReconcile')!;
    expect(parseSettingValue(toggle, true)).toBe(true);
    expect(parseSettingValue(toggle, 'false')).toBe(false);
    expect(parseSettingValue(toggle, '0')).toBe(false);
    expect(parseSettingValue(toggle, 'yes')).toBeNull();
    expect(parseSettingValue(toggle, 5)).toBeNull();
  });
});
