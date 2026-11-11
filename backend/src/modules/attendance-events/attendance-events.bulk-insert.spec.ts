import { QueryFailedError } from 'typeorm';

import { AttendanceEventsService } from './attendance-events.service';

function duplicateError() {
  return new QueryFailedError('INSERT', [], { code: 'ER_DUP_ENTRY' } as never);
}

type Helpers = {
  insertChunk(
    repository: unknown,
    chunk: Array<Record<string, unknown>>,
  ): Promise<{
    inserted: number;
    duplicates: number;
    insertedIndexes: Set<number>;
  }>;
  excludeExisting(
    repository: unknown,
    terminalId: number,
    rows: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>>;
};

const service = new AttendanceEventsService(
  ...(Array.from({ length: 8 }, () => ({})) as never[]),
) as unknown as Helpers;

const at = (iso: string) => new Date(iso);

describe('AttendanceEventsService — bulk insert', () => {
  it('bo‘lakni bitta INSERT bilan yozadi', async () => {
    const repository = { insert: jest.fn().mockResolvedValue(undefined) };
    const chunk = [{ serialNo: '1' }, { serialNo: '2' }, { serialNo: '3' }];

    const result = await service.insertChunk(repository, chunk);

    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(result.inserted).toBe(3);
    expect(result.duplicates).toBe(0);
  });

  it('unique xatosida bittalab yozishga o‘tadi va takrorni sanaydi', async () => {
    const repository = {
      insert: jest
        .fn()
        .mockRejectedValueOnce(duplicateError()) // bulk
        .mockResolvedValueOnce(undefined) // 1
        .mockRejectedValueOnce(duplicateError()) // 2 — takror
        .mockResolvedValueOnce(undefined), // 3
    };

    const result = await service.insertChunk(repository, [
      { serialNo: '1' },
      { serialNo: '2' },
      { serialNo: '3' },
    ]);

    expect(repository.insert).toHaveBeenCalledTimes(4);
    expect(result.inserted).toBe(2);
    expect(result.duplicates).toBe(1);
    expect([...result.insertedIndexes]).toEqual([0, 2]);
  });

  it('boshqa baza xatosini yashirmaydi', async () => {
    const repository = {
      insert: jest.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(
      service.insertChunk(repository, [{ serialNo: '1' }]),
    ).rejects.toThrow('boom');
  });

  it('bazada bor va sahifa ichida takrorlangan eventlarni chiqarib tashlaydi', async () => {
    const getMany = jest
      .fn()
      .mockResolvedValue([
        { serialNo: '10', eventAt: at('2026-11-11T03:00:00.000Z') },
      ]);
    const builder = {
      select: () => builder,
      where: () => builder,
      andWhere: () => builder,
      getMany,
    };
    const repository = { createQueryBuilder: () => builder };

    const rows = [
      { serialNo: '10', eventAt: at('2026-11-11T03:00:00.000Z') }, // bazada bor
      { serialNo: '10', eventAt: at('2026-11-12T03:00:00.000Z') }, // boshqa vaqt — yangi
      { serialNo: '11', eventAt: at('2026-11-11T03:01:00.000Z') }, // yangi
      { serialNo: '11', eventAt: at('2026-11-11T03:01:00.000Z') }, // sahifa ichida takror
    ];

    const fresh = await service.excludeExisting(repository, 7, rows);

    expect(fresh).toHaveLength(2);
    expect(fresh.map((row) => row.serialNo)).toEqual(['10', '11']);
  });
});
