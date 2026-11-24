import { unlink } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { safeAttendancePhotoPath } from '../attendance-photo-sync/photo-retention.rules';
import { SettingsService } from '../system-settings/settings.service';

const CURSOR_KEY = 'edavomat:event-compaction:cursor';
const LOCK_KEY = 'edavomat:event-compaction:lock';
const DAY_MS = 24 * 3600_000;
const BATCH = 5000;
const MAX_DELETED_PER_RUN = 2_000_000;
const MAX_RUN_MS = 90 * 60_000;
const TASHKENT_OFFSET = '+05:00';

type Row = Record<string, unknown>;

/**
 * daily_attendance.firstInEventId / lastOutEventId bu eventlarga tashqi kalit (RESTRICT)
 * bilan bog‘langan: ularga ishora qilinayotgan qatorlar hech qachon o‘chirilmaydi.
 * (daily_attendance faqat o‘qiladi, o‘zgartirilmaydi.)
 */
const REFERENCED_GUARD = `NOT EXISTS (
  SELECT 1 FROM daily_attendance da WHERE da.firstInEventId = t.id OR da.lastOutEventId = t.id)`;

export interface CompactionLast {
  at: string;
  deleted: number;
  files: number;
  throughDay: string | null;
  durationSeconds: number;
}

/** `YYYY-MM-DD` (Toshkent) → shu kunning boshi va keyingi kun boshi (UTC Date). */
function dayRange(day: string): { from: Date; to: Date } {
  const from = new Date(`${day}T00:00:00${TASHKENT_OFFSET}`);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

function tashkentDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
    date,
  );
}

function addDays(day: string, delta: number): string {
  return tashkentDay(
    new Date(dayRange(day).from.getTime() + delta * DAY_MS + 12 * 3600_000),
  );
}

/**
 * attendance_events tozalash: eski kunlarda har shaxs uchun faqat
 *   — eng birinchi KIRISH (IN) va
 *   — eng oxirgi CHIQISH (OUT)
 * qoladi, qolgani o‘chadi. `daily_attendance` jadvaliga umuman tegilmaydi.
 * Sozlamalardan yoqilmaguncha hech narsa o‘chirilmaydi (faqat quruq sinov).
 */
@Injectable()
export class EventCompactionService {
  private readonly logger = new Logger(EventCompactionService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  /** O‘chirilmaydigan (qoladigan) qatorlarni tanlovchi SQL: IN — birinchisi, OUT — oxirgisi. */
  private readonly candidatesSql = `
    SELECT id, photoPath FROM (
      SELECT id, photoPath, direction,
             ROW_NUMBER() OVER (PARTITION BY pnfl, direction ORDER BY eventAt ASC, id ASC) AS rnAsc,
             ROW_NUMBER() OVER (PARTITION BY pnfl, direction ORDER BY eventAt DESC, id DESC) AS rnDesc
        FROM attendance_events
       WHERE schoolId = ? AND eventAt >= ? AND eventAt < ?
    ) t
    WHERE NOT ((direction = 'IN' AND rnAsc = 1) OR (direction = 'OUT' AND rnDesc = 1))
      AND ${REFERENCED_GUARD}`;

  private cutoffDay(now = new Date()): string {
    // Shu kunga qadar (kiritilmagan): bugun − keepDays.
    return addDays(
      tashkentDay(now),
      -this.settings.getInt('eventCompactKeepDays'),
    );
  }

  // ───────────── Quruq sinov ─────────────

  /** Tasodifiy 60 ta maktabning bitta (kesim) kunidagi natijani sanaydi — hech narsa o‘chirmaydi. */
  async preview() {
    const day = addDays(this.cutoffDay(), -1);
    const { from, to } = dayRange(day);
    const schools: Row[] = await this.dataSource.query(
      'SELECT id FROM schools ORDER BY RAND() LIMIT 60',
    );
    let total = 0;
    let removable = 0;
    for (const school of schools) {
      const [counts]: Row[] = await this.dataSource.query(
        `SELECT COUNT(*) AS total,
                SUM(NOT ((direction = 'IN' AND rnAsc = 1) OR (direction = 'OUT' AND rnDesc = 1))
                    AND ${REFERENCED_GUARD}) AS removable
           FROM (
             SELECT id, direction,
                    ROW_NUMBER() OVER (PARTITION BY pnfl, direction ORDER BY eventAt ASC, id ASC) AS rnAsc,
                    ROW_NUMBER() OVER (PARTITION BY pnfl, direction ORDER BY eventAt DESC, id DESC) AS rnDesc
               FROM attendance_events
              WHERE schoolId = ? AND eventAt >= ? AND eventAt < ?
           ) t`,
        [Number(school.id), from, to],
      );
      total += Number(counts?.total ?? 0);
      removable += Number(counts?.removable ?? 0);
    }
    return {
      sampleDay: day,
      sampleSchools: schools.length,
      sampleEvents: total,
      sampleRemovable: removable,
      removablePercent:
        total > 0 ? Math.round((1000 * removable) / total) / 10 : null,
    };
  }

  async status() {
    const client = this.redis.getClient();
    const cursor = await client.get(CURSOR_KEY);
    return {
      enabled: this.settings.getBool('eventCompactEnabled'),
      keepDays: this.settings.getInt('eventCompactKeepDays'),
      cutoffDay: this.cutoffDay(),
      cursorDay: cursor,
      running: this.running,
    };
  }

  /** Oxirgi ishga tushirishlar tarixi (Bosh administrator uchun). */
  async history(limit = 50) {
    const rows: Row[] = await this.dataSource.query(
      `SELECT r.id, r.\`trigger\`, r.status, r.startedAt, r.finishedAt, r.deletedRows,
              r.deletedFiles, DATE_FORMAT(r.throughDay, '%Y-%m-%d') AS throughDay,
              r.keepDays, r.error, u.login AS startedBy
         FROM event_compaction_runs r LEFT JOIN users u ON u.id = r.startedByUserId
        ORDER BY r.id DESC LIMIT ?`,
      [limit],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      trigger: row.trigger,
      status: row.status,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      deletedRows: Number(row.deletedRows),
      deletedFiles: Number(row.deletedFiles),
      throughDay: row.throughDay,
      keepDays: Number(row.keepDays),
      error: row.error,
      startedBy: row.startedBy,
    }));
  }

  // ───────────── Haqiqiy tozalash (haftada bir marta) ─────────────

  @Cron('0 50 3 * * 0', { timeZone: 'Asia/Tashkent' })
  async scheduledRun(): Promise<void> {
    if (!this.settings.getBool('eventCompactEnabled')) return;
    await this.run('SCHEDULED', null);
  }

  async run(
    trigger: 'SCHEDULED' | 'MANUAL' = 'MANUAL',
    userId: number | null = null,
  ): Promise<CompactionLast | null> {
    if (this.running) return null;
    const client = this.redis.getClient();
    const locked = await client.set(LOCK_KEY, '1', 'EX', 2 * 3600, 'NX');
    if (locked !== 'OK') return null;
    this.running = true;
    const started = Date.now();
    let deleted = 0;
    let files = 0;
    let throughDay: string | null = null;
    let failure: string | null = null;
    let partial = false;
    const insert = await this.dataSource.query<{ insertId: number }>(
      `INSERT INTO event_compaction_runs (\`trigger\`, status, keepDays, startedByUserId)
       VALUES (?, 'RUNNING', ?, ?)`,
      [trigger, this.settings.getInt('eventCompactKeepDays'), userId],
    );
    const runId = Number(insert.insertId);

    try {
      const cutoff = this.cutoffDay();
      let day = await this.startDay(client);
      const schoolRows: Row[] = await this.dataSource.query(
        'SELECT id FROM schools',
      );
      const schoolIds = schoolRows.map((row) => Number(row.id));

      // Kun-kunma: faqat kesimdan OLDINGI to‘liq kunlar.
      while (day < cutoff) {
        if (
          deleted >= MAX_DELETED_PER_RUN ||
          Date.now() - started > MAX_RUN_MS
        ) {
          partial = true;
          break;
        }
        const { from, to } = dayRange(day);
        for (const schoolId of schoolIds) {
          const result = await this.compactSchoolDay(schoolId, from, to);
          deleted += result.deleted;
          files += result.files;
        }
        throughDay = day;
        day = addDays(day, 1);
        await client.set(CURSOR_KEY, day);
      }
    } catch (error) {
      failure = (error as Error).message.slice(0, 250);
      this.logger.error(`Eventlarni tozalash xatosi: ${failure}`);
    } finally {
      this.running = false;
      await client.del(LOCK_KEY).catch(() => undefined);
    }

    const last: CompactionLast = {
      at: new Date().toISOString(),
      deleted,
      files,
      throughDay,
      durationSeconds: Math.round((Date.now() - started) / 1000),
    };
    await this.dataSource
      .query(
        `UPDATE event_compaction_runs
            SET status = ?, finishedAt = NOW(3), deletedRows = ?, deletedFiles = ?,
                throughDay = ?, error = ?
          WHERE id = ?`,
        [
          failure ? 'FAILED' : partial ? 'PARTIAL' : 'DONE',
          deleted,
          files,
          throughDay,
          failure,
          runId,
        ],
      )
      .catch(() => undefined);
    this.logger.log(
      `Eventlar tozalandi: ${deleted} qator, ${files} rasm fayli, ${last.durationSeconds}s`,
    );
    return last;
  }

  /** Davom ettiriladigan kun: Redis'dagi kursor, yo‘q bo‘lsa — eng eski event kuni. */
  private async startDay(client: ReturnType<RedisService['getClient']>) {
    const saved = await client.get(CURSOR_KEY);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
    // Eng eski event kuni: har terminal bo‘yicha (terminalId, eventAt) indeksidan MIN —
    // butun jadvalni skanerlamaydi va orqaga qarab kiritilgan (backfill) eventlarni ham topadi.
    const terminals: Row[] = await this.dataSource.query(
      'SELECT id FROM terminals',
    );
    let oldest: Date | null = null;
    for (const terminal of terminals) {
      const [row]: Row[] = await this.dataSource.query(
        'SELECT MIN(eventAt) AS first FROM attendance_events WHERE terminalId = ?',
        [Number(terminal.id)],
      );
      if (row?.first) {
        const at = new Date(row.first as Date);
        if (!oldest || at < oldest) oldest = at;
      }
    }
    return oldest ? addDays(tashkentDay(oldest), -1) : tashkentDay(new Date());
  }

  private async compactSchoolDay(schoolId: number, from: Date, to: Date) {
    let deleted = 0;
    let files = 0;
    for (;;) {
      const rows: Row[] = await this.dataSource.query(
        `${this.candidatesSql} LIMIT ${BATCH}`,
        [schoolId, from, to],
      );
      if (rows.length === 0) break;
      const ids = rows.map((row) => String(row.id));
      await this.dataSource.query(
        `DELETE FROM attendance_events WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
      deleted += rows.length;
      for (const row of rows) {
        if (typeof row.photoPath !== 'string' || row.photoPath === '') continue;
        const target = safeAttendancePhotoPath(row.photoPath, process.cwd());
        if (!target) continue;
        try {
          await unlink(target);
          files += 1;
        } catch {
          /* fayl allaqachon yo‘q — muhim emas */
        }
      }
      if (rows.length < BATCH) break;
    }
    return { deleted, files };
  }
}
