import { groupAttendanceEvents } from './attendance-event-groups';

interface TestEvent {
  id: string;
  terminalId: number;
  pnfl: string;
  direction: string;
  eventAt: Date;
}

function event(
  id: string,
  time: string,
  terminalId = 337,
  direction = 'OUT',
  pnfl = '12345678901234',
): TestEvent {
  return {
    id,
    terminalId,
    pnfl,
    direction,
    eventAt: new Date(`2026-10-20T${time}+05:00`),
  };
}

describe('groupAttendanceEvents', () => {
  it('5 soniya ichidagi eventlarni guruhlaydi', () => {
    const events = [
      event('1', '07:55:29'),
      event('2', '07:55:31'),
      event('3', '07:55:32'),
      event('4', '07:55:34'),
    ];

    const groups = groupAttendanceEvents(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].eventCount).toBe(4);
    expect(groups[0].firstEvent.id).toBe('1');
    expect(groups[0].lastEvent.id).toBe('4');
  });

  it('5 soniyadan katta tanaffusda yangi guruh yaratadi', () => {
    const events = [
      event('1', '07:55:29'),
      event('2', '07:55:31'),
      event('3', '07:56:00'),
    ];

    const groups = groupAttendanceEvents(events);

    expect(groups).toHaveLength(2);
    expect(groups[0].eventCount).toBe(2);
    expect(groups[1].eventCount).toBe(1);
  });

  it('IN va OUT eventlarini ajratadi', () => {
    const groups = groupAttendanceEvents([
      event('1', '07:55:29', 337, 'IN'),
      event('2', '07:55:30', 337, 'OUT'),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('turli terminallarni alohida guruhlaydi', () => {
    const groups = groupAttendanceEvents([
      event('1', '07:55:29', 337),
      event('2', '07:55:30', 338),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('turli shaxslarni alohida guruhlaydi', () => {
    const groups = groupAttendanceEvents([
      event('1', '07:55:29', 337, 'OUT', '12345678901234'),
      event('2', '07:55:30', 337, 'OUT', '98765432109876'),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('tartibsiz kelgan eventlarni vaqt bo‘yicha saralaydi', () => {
    const groups = groupAttendanceEvents([
      event('3', '07:55:32'),
      event('1', '07:55:29'),
      event('2', '07:55:31'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].firstEvent.id).toBe('1');
    expect(groups[0].lastEvent.id).toBe('3');
  });

  it('bo‘sh eventlar ro‘yxatini qabul qiladi', () => {
    expect(groupAttendanceEvents([])).toEqual([]);
  });

  it('noto‘g‘ri vaqt chegarasini rad etadi', () => {
    expect(() => groupAttendanceEvents([], -1)).toThrow();
  });

  it('asl eventlar tartibini o‘zgartirmaydi', () => {
    const events = [event('2', '07:55:31'), event('1', '07:55:29')];

    groupAttendanceEvents(events);

    expect(events.map((item) => item.id)).toEqual(['2', '1']);
  });
});
