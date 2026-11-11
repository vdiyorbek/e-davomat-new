import { TerminalSyncService } from './terminal-sync.service';

/** Kichik in-memory Redis o‘rnini bosuvchi. */
function fakeRedis(failing = false) {
  const store = new Map<string, string>();
  const client = {
    store,
    exists: jest.fn((key: string) => {
      if (failing) return Promise.reject(new Error('down'));
      return Promise.resolve(store.has(key) ? 1 : 0);
    }),
    set: jest.fn((key: string, value: string, ...args: unknown[]) => {
      if (failing) return Promise.reject(new Error('down'));
      if (args.includes('NX') && store.has(key)) return Promise.resolve(null);
      store.set(key, value);
      return Promise.resolve('OK');
    }),
  };
  return client;
}

function makeService(redis: ReturnType<typeof fakeRedis>) {
  const redisService = { getClient: () => redis };
  return new TerminalSyncService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    redisService as never,
  ) as unknown as {
    needsRebuild(
      schoolId: number,
      date: string,
      inserted: number,
    ): Promise<boolean>;
  };
}

describe('TerminalSyncService — kunlik davomatni qayta hisoblash qarori', () => {
  it('yangi event bo‘lsa doim hisoblaydi', async () => {
    const service = makeService(fakeRedis());
    await expect(service.needsRebuild(1, '2026-11-11', 3)).resolves.toBe(true);
  });

  it('yangi event yo‘q va yaqinda hisoblangan bo‘lsa — o‘tkazib yuboradi', async () => {
    const redis = fakeRedis();
    redis.store.set('edav:attendance:rebuild-fresh:1:2026-11-11', '1');
    const service = makeService(redis);
    await expect(service.needsRebuild(1, '2026-11-11', 0)).resolves.toBe(false);
  });

  it('oldingi hisoblash yakunlanmagan bo‘lsa (pending) — hisoblaydi', async () => {
    const redis = fakeRedis();
    redis.store.set('edav:attendance:rebuild-fresh:1:2026-11-11', '1');
    redis.store.set('edav:attendance:rebuild-pending:1:2026-11-11', '1');
    const service = makeService(redis);
    await expect(service.needsRebuild(1, '2026-11-11', 0)).resolves.toBe(true);
  });

  it('10 daqiqada hisoblanmagan bo‘lsa — bir marta xavfsizlik hisoblashi', async () => {
    const service = makeService(fakeRedis());
    await expect(service.needsRebuild(1, '2026-11-11', 0)).resolves.toBe(true);
    // Ikkinchi chaqiruvda kalit band — qayta hisoblanmaydi.
    await expect(service.needsRebuild(1, '2026-11-11', 0)).resolves.toBe(false);
  });

  it('Redis ishlamasa — xavfsiz tomonga: hisoblaydi', async () => {
    const service = makeService(fakeRedis(true));
    await expect(service.needsRebuild(1, '2026-11-11', 0)).resolves.toBe(true);
  });
});
