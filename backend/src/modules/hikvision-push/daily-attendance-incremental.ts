import type { EntityManager } from 'typeorm';

export interface IncrementalEvent {
  id: string;
  schoolId: number;
  date: string;
  pnfl: string;
  direction: string;
  eventAt: Date;
}

interface Candidate {
  schoolId: number;
  date: string;
  pnfl: string;
  at: Date;
  id: string;
}

const CHUNK = 200;

/** Rebuild bilan bir xil tartib: (eventAt, id). */
function earlier(a: Candidate, b: Candidate): boolean {
  const diff = a.at.getTime() - b.at.getTime();
  return diff < 0 || (diff === 0 && BigInt(a.id) < BigInt(b.id));
}

/**
 * Paketdagi har bir shaxs-kun uchun eng birinchi IN va eng oxirgi OUT.
 */
export function pickExtremes(events: IncrementalEvent[]) {
  const firstIn = new Map<string, Candidate>();
  const lastOut = new Map<string, Candidate>();

  for (const event of events) {
    const key = `${event.schoolId}:${event.date}:${event.pnfl}`;
    const candidate: Candidate = {
      schoolId: event.schoolId,
      date: event.date,
      pnfl: event.pnfl,
      at: event.eventAt,
      id: event.id,
    };

    if (event.direction === 'IN') {
      const current = firstIn.get(key);
      if (!current || earlier(candidate, current)) firstIn.set(key, candidate);
    } else if (event.direction === 'OUT') {
      const current = lastOut.get(key);
      if (!current || earlier(current, candidate)) lastOut.set(key, candidate);
    }
  }

  return { firstIn: [...firstIn.values()], lastOut: [...lastOut.values()] };
}

function derivedTable(rows: Candidate[], params: unknown[]): string {
  return rows
    .map((row, index) => {
      params.push(row.schoolId, row.date, row.pnfl, row.at, row.id);
      return index === 0
        ? 'SELECT ? AS schoolId, ? AS date, ? AS pnfl, ? AS at, ? AS eventId'
        : 'SELECT ?, ?, ?, ?, ?';
    })
    .join(' UNION ALL ');
}

/**
 * Yangi eventlarni daily_attendance'ga to‘liq qayta hisoblamasdan yozadi.
 * Faqat mavjud qatorlar yangilanadi (ularni kunning birinchi rebuild'i
 * yaratadi). Shu sababli natija rebuild natijasi bilan bir xil bo‘ladi.
 *
 * Chaqiruvchi tranzaksiya ichida maktab qatorlarini FOR UPDATE bilan
 * qulflaydi — rebuild ham aynan shu qulfni oladi, ikkalasi to‘qnashmaydi.
 */
export async function applyIncremental(
  manager: EntityManager,
  events: IncrementalEvent[],
): Promise<number> {
  const { firstIn, lastOut } = pickExtremes(events);
  let affected = 0;

  for (let i = 0; i < firstIn.length; i += CHUNK) {
    const params: unknown[] = [];
    const table = derivedTable(firstIn.slice(i, i + CHUNK), params);
    const result: unknown = await manager.query(
      `UPDATE daily_attendance d
         JOIN (${table}) x
           ON d.schoolId = x.schoolId AND d.date = x.date AND d.pnfl = x.pnfl
          SET d.firstInTime = x.at, d.firstInEventId = x.eventId
        WHERE d.firstInTime IS NULL
           OR d.firstInTime > x.at
           OR (d.firstInTime = x.at AND d.firstInEventId > x.eventId)`,
      params,
    );
    affected += Number(
      (result as { affectedRows?: number })?.affectedRows ?? 0,
    );
  }

  for (let i = 0; i < lastOut.length; i += CHUNK) {
    const params: unknown[] = [];
    const table = derivedTable(lastOut.slice(i, i + CHUNK), params);
    const result: unknown = await manager.query(
      `UPDATE daily_attendance d
         JOIN (${table}) x
           ON d.schoolId = x.schoolId AND d.date = x.date AND d.pnfl = x.pnfl
          SET d.lastOutTime = x.at, d.lastOutEventId = x.eventId
        WHERE d.lastOutTime IS NULL
           OR d.lastOutTime < x.at
           OR (d.lastOutTime = x.at AND d.lastOutEventId < x.eventId)`,
      params,
    );
    affected += Number(
      (result as { affectedRows?: number })?.affectedRows ?? 0,
    );
  }

  return affected;
}
