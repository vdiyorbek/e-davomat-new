import { toTerminalTime } from './hikvision-events.service';

describe('toTerminalTime', () => {
  it('UTC vaqtni millisekundsiz +05:00 ko‘rinishiga o‘tkazadi', () => {
    expect(toTerminalTime('2026-11-18T19:00:00.000Z')).toBe(
      '2026-11-19T00:00:00+05:00',
    );
  });

  it('allaqachon +05:00 bo‘lsa o‘zgartirmaydi', () => {
    expect(toTerminalTime('2026-11-19T07:33:10+05:00')).toBe(
      '2026-11-19T07:33:10+05:00',
    );
  });

  it('sonli vaqt (ms) ham qabul qilinadi', () => {
    expect(toTerminalTime(Date.parse('2026-11-19T02:33:10.789Z'))).toBe(
      '2026-11-19T07:33:10+05:00',
    );
  });
});
