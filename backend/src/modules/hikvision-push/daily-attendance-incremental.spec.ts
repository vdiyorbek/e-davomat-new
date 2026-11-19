import { applyIncremental, pickExtremes } from './daily-attendance-incremental';
import type { IncrementalEvent } from './daily-attendance-incremental';
import type { EntityManager } from 'typeorm';

const base = { schoolId: 1, date: '2026-11-18', pnfl: '12345678901234' };
const at = (time: string) => new Date(`2026-11-18T${time}+05:00`);

describe('daily_attendance inkremental yangilash', () => {
  it('rebuild bilan bir xil: eng erta IN va eng kech OUT', () => {
    const events: IncrementalEvent[] = [
      { ...base, id: '5', direction: 'IN', eventAt: at('08:05:00') },
      { ...base, id: '3', direction: 'IN', eventAt: at('08:01:00') },
      { ...base, id: '4', direction: 'IN', eventAt: at('08:01:00') },
      { ...base, id: '9', direction: 'OUT', eventAt: at('13:00:00') },
      { ...base, id: '8', direction: 'OUT', eventAt: at('13:10:00') },
    ];

    const { firstIn, lastOut } = pickExtremes(events);

    expect(firstIn).toHaveLength(1);
    expect(firstIn[0].id).toBe('3');
    expect(lastOut).toHaveLength(1);
    expect(lastOut[0].id).toBe('8');
  });

  it('har bir shaxs uchun alohida, bitta UPDATE bilan yozadi', async () => {
    const query = jest.fn().mockResolvedValue({ affectedRows: 2 });
    const manager = { query } as unknown as EntityManager;

    const affected = await applyIncremental(manager, [
      { ...base, id: '1', direction: 'IN', eventAt: at('08:00:00') },
      {
        ...base,
        pnfl: '99999999999999',
        id: '2',
        direction: 'IN',
        eventAt: at('08:00:01'),
      },
    ]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('UNION ALL');
    expect(query.mock.calls[0][1]).toHaveLength(10);
    expect(affected).toBe(2);
  });
});
