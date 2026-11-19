import { applyAssignment } from './class-shifts.service';
import type { SchoolClassShift } from './school-class-shift.entity';

const row = (
  id: number,
  shiftId: number,
  startDate: string,
  endDate: string | null,
) => ({ id, classId: 1, shiftId, startDate, endDate }) as SchoolClassShift;

describe('Sinf smenasini tayinlash', () => {
  it('birinchi tayinlov ochiq interval yaratadi', () => {
    expect(applyAssignment([], 1, 10, '2026-11-18')).toEqual({
      save: [],
      create: {
        classId: 1,
        shiftId: 10,
        startDate: '2026-11-18',
        endDate: null,
      },
    });
  });

  it('smena o‘zgarsa eski interval yangi sanada yopiladi', () => {
    const history = [row(1, 10, '2026-09-01', null)];
    const result = applyAssignment(history, 1, 20, '2026-11-18');

    expect(result.save[0].endDate).toBe('2026-11-18');
    expect(result.create).toMatchObject({ shiftId: 20, endDate: null });
  });

  it('o‘sha smena qayta tanlansa hech narsa o‘zgarmaydi', () => {
    const history = [row(1, 10, '2026-09-01', null)];
    expect(applyAssignment(history, 1, 10, '2026-11-18')).toEqual({
      save: [],
      create: null,
    });
  });

  it('kelajakdagi tayinlov oldidan qo‘yilsa, unga qadar davom etadi', () => {
    const history = [
      row(1, 10, '2026-09-01', '2026-12-01'),
      row(2, 10, '2026-12-01', null),
    ];
    const result = applyAssignment(history, 1, 20, '2026-11-18');

    expect(result.create).toMatchObject({ endDate: '2026-12-01' });
  });
});
