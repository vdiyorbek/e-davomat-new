import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface PushTerminal {
  id: number;
  schoolId: number;
  direction: string;
}

/**
 * Push yoqilgan terminallar ro‘yxati xotirada saqlanadi: har so‘rovda
 * MySQL'ga murojaat qilinmaydi. 10 000 terminal ≈ 1–2 MB xotira.
 * Ro‘yxat davriy va Redis signali bilan darhol yangilanadi.
 */
export class TerminalRegistry {
  private byTokenHash = new Map<string, PushTerminal>();
  private loading: Promise<void> | null = null;
  private lastReceived = new Map<number, number>();

  constructor(private readonly pool: Pool) {}

  get size(): number {
    return this.byTokenHash.size;
  }

  find(tokenHash: string): PushTerminal | undefined {
    return this.byTokenHash.get(tokenHash);
  }

  /** Bir vaqtda faqat bitta yuklash; qolgan chaqiruvlar uni kutadi. */
  reload(): Promise<void> {
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, schoolId, direction, pushTokenHash
         FROM terminals
        WHERE eventSource = 'PUSH' AND pushEnabled = 1 AND isActive = 1
          AND archivedAt IS NULL AND pushTokenHash IS NOT NULL`,
    );

    const next = new Map<string, PushTerminal>();
    for (const row of rows) {
      next.set(String(row.pushTokenHash), {
        id: Number(row.id),
        schoolId: Number(row.schoolId),
        direction: String(row.direction),
      });
    }
    this.byTokenHash = next;
  }

  markReceived(terminalId: number): void {
    this.lastReceived.set(terminalId, Date.now());
  }

  /**
   * `pushLastReceivedAt` har so‘rovda emas, guruhlab yoziladi:
   * 10 000 terminal → 30 soniyada bitta-ikkita UPDATE.
   */
  async flushReceived(): Promise<void> {
    if (this.lastReceived.size === 0) return;
    const entries = [...this.lastReceived];
    this.lastReceived = new Map();

    for (let i = 0; i < entries.length; i += 1000) {
      const chunk = entries.slice(i, i + 1000);
      const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
      const params: unknown[] = [];
      for (const [id, at] of chunk) params.push(id, new Date(at));
      params.push(...chunk.map(([id]) => id));

      try {
        await this.pool.query(
          `UPDATE terminals
              SET pushLastReceivedAt = GREATEST(
                    COALESCE(pushLastReceivedAt, '1970-01-01'),
                    CASE id ${cases} END)
            WHERE id IN (${chunk.map(() => '?').join(',')})`,
          params,
        );
      } catch {
        // Monitoring vaqti muhim emas: keyingi safar yana yoziladi.
        for (const [id, at] of chunk) {
          if (!this.lastReceived.has(id)) this.lastReceived.set(id, at);
        }
      }
    }
  }
}
