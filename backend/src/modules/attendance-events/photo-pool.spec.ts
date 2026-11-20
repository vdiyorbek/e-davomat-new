import { AttendanceEventPhotosService } from './attendance-event-photos.service';

type Pool = <T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
) => Promise<void>;

function runPool(): Pool {
  const service = Object.create(
    AttendanceEventPhotosService.prototype,
  ) as unknown as { runPool: Pool };
  return (items, concurrency, handler) =>
    service.runPool(items, concurrency, handler);
}

describe('Rasm yuklash: cheklangan parallellik', () => {
  it('bir vaqtda sozlangan sondan ko‘p ishlamaydi va hammasini bajaradi', async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];

    await runPool()([1, 2, 3, 4, 5, 6, 7, 8], 3, async (item) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      done.push(item);
      active--;
    });

    expect(peak).toBe(3);
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('1 bo‘lsa ketma-ket ishlaydi', async () => {
    let active = 0;
    let peak = 0;
    await runPool()([1, 2, 3], 1, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
    });
    expect(peak).toBe(1);
  });

  it('xato bo‘lsa to‘xtaydi va xatoni qaytaradi', async () => {
    const started: number[] = [];
    await expect(
      runPool()([1, 2, 3, 4, 5, 6], 2, async (item) => {
        started.push(item);
        await Promise.resolve();
        if (item === 2) throw new Error('baza xatosi');
      }),
    ).rejects.toThrow('baza xatosi');
    expect(started.length).toBeLessThan(6);
  });

  it('bo‘sh ro‘yxat muammo tug‘dirmaydi', async () => {
    await expect(
      runPool()([], 3, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });
});
