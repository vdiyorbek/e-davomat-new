import {
  canModifyTalk,
  countStatuses,
  dayStatus,
  DayStatusInput,
  followUpValid,
  normalizeIds,
  talkDateValid,
  TALK_EDIT_WINDOW_MS,
} from './inspector.rules';

const base: DayStatusInput = {
  workDay: true,
  excused: false,
  firstIn: null,
  late: false,
  isToday: false,
  nowTime: '12:00',
  absentCheckTime: '09:00:00',
};

describe('dayStatus', () => {
  it('kirgan bo‘lsa PRESENT', () => {
    expect(dayStatus({ ...base, firstIn: new Date() })).toBe('PRESENT');
  });

  it('kechikib kirgan bo‘lsa LATE', () => {
    expect(dayStatus({ ...base, firstIn: new Date(), late: true })).toBe(
      'LATE',
    );
  });

  it('dam olish kunida kirgan bo‘lsa ham PRESENT', () => {
    expect(dayStatus({ ...base, workDay: false, firstIn: new Date() })).toBe(
      'PRESENT',
    );
  });

  it('kirmagan, sababnomasi bor bo‘lsa EXCUSED', () => {
    expect(dayStatus({ ...base, excused: true })).toBe('EXCUSED');
  });

  it('o‘quv kuni bo‘lmasa DAY_OFF', () => {
    expect(dayStatus({ ...base, workDay: false })).toBe('DAY_OFF');
  });

  it('bugun tekshiruv vaqtigacha PENDING', () => {
    expect(dayStatus({ ...base, isToday: true, nowTime: '08:30' })).toBe(
      'PENDING',
    );
  });

  it('bugun tekshiruv vaqtidan keyin ABSENT', () => {
    expect(dayStatus({ ...base, isToday: true, nowTime: '09:00' })).toBe(
      'ABSENT',
    );
  });

  it('o‘tgan kunda kirmagan bo‘lsa ABSENT', () => {
    expect(dayStatus(base)).toBe('ABSENT');
  });

  it('sababnoma dam olish kunidan ustun', () => {
    expect(dayStatus({ ...base, workDay: false, excused: true })).toBe(
      'EXCUSED',
    );
  });
});

describe('canModifyTalk', () => {
  const created = new Date('2026-11-01T10:00:00Z');

  it('24 soat ichida mumkin', () => {
    const now = new Date(created.getTime() + TALK_EDIT_WINDOW_MS - 1);
    expect(canModifyTalk(created, now)).toBe(true);
  });

  it('24 soatdan keyin mumkin emas', () => {
    const now = new Date(created.getTime() + TALK_EDIT_WINDOW_MS + 1);
    expect(canModifyTalk(created, now)).toBe(false);
  });

  it('kelajakdagi yaratilish vaqti mumkin emas', () => {
    const now = new Date(created.getTime() - 1);
    expect(canModifyTalk(created, now)).toBe(false);
  });
});

describe('normalizeIds', () => {
  it('takrorlarni olib tashlaydi va tartiblaydi', () => {
    expect(normalizeIds([3, 1, 3, '2'])).toEqual([1, 2, 3]);
  });

  it('noto‘g‘ri qiymatlarni tashlab yuboradi', () => {
    expect(normalizeIds([0, -1, 1.5, 'abc', null, undefined, 4])).toEqual([4]);
  });
});

describe('talkDateValid', () => {
  const today = '2026-11-08';

  it('bugun yaroqli', () => {
    expect(talkDateValid('2026-11-08', today)).toBe(true);
  });

  it('kelajak yaroqsiz', () => {
    expect(talkDateValid('2026-11-09', today)).toBe(false);
  });

  it('aynan 1 yil oldin yaroqli', () => {
    expect(talkDateValid('2025-11-08', today)).toBe(true);
  });

  it('1 yildan eski yaroqsiz', () => {
    expect(talkDateValid('2025-11-07', today)).toBe(false);
  });
});

describe('followUpValid', () => {
  it('suhbat kunining o‘zi yaroqsiz', () => {
    expect(followUpValid('2026-11-08', '2026-11-08')).toBe(false);
  });

  it('keyingi kun yaroqli', () => {
    expect(followUpValid('2026-11-08', '2026-11-09')).toBe(true);
  });

  it('aynan 6 oydan keyin yaroqli', () => {
    expect(followUpValid('2026-11-08', '2027-05-08')).toBe(true);
  });

  it('6 oydan oshsa yaroqsiz', () => {
    expect(followUpValid('2026-11-08', '2027-05-09')).toBe(false);
  });
});

describe('countStatuses', () => {
  it('holatlarni sanaydi, bo‘sh holatlar 0 bo‘ladi', () => {
    expect(countStatuses(['ABSENT', 'ABSENT', 'PRESENT'])).toEqual({
      PRESENT: 1,
      LATE: 0,
      EXCUSED: 0,
      ABSENT: 2,
      PENDING: 0,
      DAY_OFF: 0,
    });
  });
});
