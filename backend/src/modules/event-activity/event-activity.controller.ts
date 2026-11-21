import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { tashkentDate } from '../hikvision-push/hikvision-push.types';
import {
  PUSH_ABORTED_KEY_PREFIX,
  PUSH_LAG_KEY_PREFIX,
} from '../hikvision-push/hikvision-push.types';
import { UserRole } from '../users/enums/user-role.enum';

const SOURCES = ['PUSH', 'AUTO_PULL', 'MANUAL_PULL'] as const;
const IDLE_AFTER_MS = 10 * 60_000;
const RECENT_MS = 3 * 60_000;
const ATTENTION_ORDER: Record<string, number> = {
  LAGGING: 0,
  NEVER: 1,
  IDLE: 2,
};

function positive(raw: string | undefined, fallback: number, max: number) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value) || value > max) {
    throw new BadRequestException('Qiymat noto‘g‘ri');
  }
  return value;
}

function day(raw: string | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00+05:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(date.getTime())) {
    throw new BadRequestException('Sana noto‘g‘ri');
  }
  return date;
}

export interface TerminalDay {
  terminalId: number;
  terminalName: string | null;
  schoolName: string | null;
  push: {
    received: number;
    inserted: number;
    duplicates: number;
    withPicture: number;
    withoutPicture: number;
    maxLagSeconds: number;
  };
  pull: { received: number; inserted: number };
}

/** Push va «olish» faoliyati: sinxronlash tarixi sahifasining «Push» yorlig‘i. */
@Controller('terminal-event-activity')
@Roles(UserRole.SUPER_ADMIN)
export class EventActivityController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('terminalId') terminalRaw?: string,
    @Query('source') sourceRaw?: string,
    @Query('dateFrom') fromRaw?: string,
    @Query('dateTo') toRaw?: string,
  ) {
    const page = positive(pageRaw, 1, 1_000_000);
    const limit = positive(limitRaw, 20, 100);
    const where: string[] = [];
    const params: unknown[] = [];

    if (terminalRaw) {
      where.push('a.terminalId = ?');
      params.push(positive(terminalRaw, 1, 4294967295));
    }
    if (sourceRaw && sourceRaw !== 'ALL') {
      if (!(SOURCES as readonly string[]).includes(sourceRaw)) {
        throw new BadRequestException('Manba noto‘g‘ri');
      }
      where.push('a.source = ?');
      params.push(sourceRaw);
    }
    const from = day(fromRaw);
    const to = day(toRaw);
    if (from && to && from > to) {
      throw new BadRequestException('Boshlanish sanasi tugash sanasidan keyin');
    }
    if (from) {
      where.push('a.hourStart >= ?');
      params.push(from);
    }
    if (to) {
      where.push('a.hourStart < ?');
      params.push(new Date(to.getTime() + 24 * 3_600_000));
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }], items] = await Promise.all([
      this.dataSource.query<{ total: string }[]>(
        `SELECT COUNT(*) AS total FROM terminal_event_activity a ${filter}`,
        params,
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT a.terminalId, t.name AS terminalName, s.name AS schoolName, a.source, a.hourStart,
                a.received, a.inserted, a.duplicates, a.withPicture, a.withoutPicture,
                a.maxLagSeconds, a.runs
           FROM terminal_event_activity a
           LEFT JOIN terminals t ON t.id = a.terminalId
           LEFT JOIN schools s ON s.id = a.schoolId
           ${filter}
          ORDER BY a.hourStart DESC, a.terminalId, a.source
          LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit],
      ),
    ]);

    const totalItems = Number(total);
    return {
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
      items: items.map((row) => ({
        terminalId: Number(row.terminalId),
        terminalName: (row.terminalName as string | null) ?? null,
        schoolName: (row.schoolName as string | null) ?? null,
        source: String(row.source),
        hourStart: row.hourStart as Date,
        received: Number(row.received),
        inserted: Number(row.inserted),
        duplicates: Number(row.duplicates),
        withPicture: Number(row.withPicture),
        withoutPicture: Number(row.withoutPicture),
        maxLagSeconds: Number(row.maxLagSeconds),
        runs: Number(row.runs),
      })),
    };
  }

  /**
   * Bir kunlik ko‘rinish (Toshkent kuni): soatlar bo‘yicha va terminallar bo‘yicha.
   * Push (terminal yuboradi) va «olish» (server so‘raydi) alohida hisoblanadi.
   */
  @Get('day')
  @Header('Cache-Control', 'private, no-store')
  async dayView(@Query('date') dateRaw?: string) {
    const from =
      day(dateRaw) ?? new Date(`${tashkentDate(new Date())}T00:00:00+05:00`);
    const to = new Date(from.getTime() + 24 * 3_600_000);

    const [hourRows, terminalRows] = await Promise.all([
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT HOUR(DATE_ADD(hourStart, INTERVAL 5 HOUR)) AS h, source,
                SUM(received) AS received, SUM(inserted) AS inserted, SUM(duplicates) AS duplicates,
                SUM(withPicture) AS withPicture, SUM(withoutPicture) AS withoutPicture,
                COUNT(DISTINCT terminalId) AS terminals
           FROM terminal_event_activity
          WHERE hourStart >= ? AND hourStart < ?
          GROUP BY h, source`,
        [from, to],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT a.terminalId, t.name AS terminalName, s.name AS schoolName, a.source,
                SUM(a.received) AS received, SUM(a.inserted) AS inserted, SUM(a.duplicates) AS duplicates,
                SUM(a.withPicture) AS withPicture, SUM(a.withoutPicture) AS withoutPicture,
                MAX(a.maxLagSeconds) AS maxLagSeconds
           FROM terminal_event_activity a
           LEFT JOIN terminals t ON t.id = a.terminalId
           LEFT JOIN schools s ON s.id = a.schoolId
          WHERE a.hourStart >= ? AND a.hourStart < ?
          GROUP BY a.terminalId, t.name, s.name, a.source`,
        [from, to],
      ),
    ]);

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      push: { received: 0, inserted: 0, duplicates: 0, terminals: 0 },
      pull: { received: 0, inserted: 0, duplicates: 0, terminals: 0 },
    }));
    for (const row of hourRows) {
      const bucket = hours[Number(row.h)];
      if (!bucket) continue;
      const side = row.source === 'PUSH' ? bucket.push : bucket.pull;
      side.received += Number(row.received);
      side.inserted += Number(row.inserted);
      side.duplicates += Number(row.duplicates);
      side.terminals += Number(row.terminals);
    }

    const byTerminal = new Map<number, TerminalDay>();
    for (const row of terminalRows) {
      const id = Number(row.terminalId);
      const entry = byTerminal.get(id) ?? {
        terminalId: id,
        terminalName: (row.terminalName as string | null) ?? null,
        schoolName: (row.schoolName as string | null) ?? null,
        push: {
          received: 0,
          inserted: 0,
          duplicates: 0,
          withPicture: 0,
          withoutPicture: 0,
          maxLagSeconds: 0,
        },
        pull: { received: 0, inserted: 0 },
      };
      if (row.source === 'PUSH') {
        entry.push = {
          received: Number(row.received),
          inserted: Number(row.inserted),
          duplicates: Number(row.duplicates),
          withPicture: Number(row.withPicture),
          withoutPicture: Number(row.withoutPicture),
          maxLagSeconds: Number(row.maxLagSeconds),
        };
      } else {
        entry.pull.received += Number(row.received);
        entry.pull.inserted += Number(row.inserted);
      }
      byTerminal.set(id, entry);
    }

    const terminals = [...byTerminal.values()].sort(
      (a, b) => b.push.received - a.push.received,
    );
    const sum = (pick: (t: TerminalDay) => number) =>
      terminals.reduce((total, item) => total + pick(item), 0);

    return {
      date: tashkentDate(from),
      hours,
      terminals,
      totals: {
        pushReceived: sum((t) => t.push.received),
        pushInserted: sum((t) => t.push.inserted),
        pushDuplicates: sum((t) => t.push.duplicates),
        pushWithPicture: sum((t) => t.push.withPicture),
        pushWithoutPicture: sum((t) => t.push.withoutPicture),
        pullInserted: sum((t) => t.pull.inserted),
        terminals: terminals.length,
      },
    };
  }

  /** Push holati: terminallar (real vaqtda / kechikmoqda / jim) va bugungi jami. */
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  async summary() {
    const todayStart = new Date(`${tashkentDate(new Date())}T00:00:00+05:00`);

    const [terminals, today] = await Promise.all([
      this.dataSource.query<
        {
          id: number;
          name: string;
          schoolName: string | null;
          pushLastReceivedAt: Date | null;
          pushLastEventAt: Date | null;
        }[]
      >(
        `SELECT t.id, t.name, s.name AS schoolName, t.pushLastReceivedAt, t.pushLastEventAt
           FROM terminals t LEFT JOIN schools s ON s.id = t.schoolId
          WHERE t.eventSource = 'PUSH' AND t.pushEnabled = 1 AND t.isActive = 1
            AND t.archivedAt IS NULL`,
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT source, SUM(received) AS received, SUM(inserted) AS inserted,
                SUM(duplicates) AS duplicates, SUM(withPicture) AS withPicture,
                SUM(withoutPicture) AS withoutPicture, MAX(maxLagSeconds) AS maxLagSeconds
           FROM terminal_event_activity WHERE hourStart >= ? GROUP BY source`,
        [todayStart],
      ),
    ]);

    // Kechikish belgisini push yozuvchi qo‘yadi (eski eventlar kelayotganda).
    const redis = this.redisService.getClient();
    const pipeline = redis.pipeline();
    for (const terminal of terminals) {
      pipeline.exists(`${PUSH_LAG_KEY_PREFIX}${terminal.id}`);
    }
    const lagResults = terminals.length > 0 ? await pipeline.exec() : [];

    const now = Date.now();
    const rows = terminals.map((terminal, index) => {
      const received = terminal.pushLastReceivedAt
        ? terminal.pushLastReceivedAt.getTime()
        : null;
      const lagging = Number(lagResults?.[index]?.[1] ?? 0) === 1;
      const status =
        received === null
          ? 'NEVER'
          : now - received > IDLE_AFTER_MS
            ? 'IDLE'
            : lagging && now - received <= RECENT_MS * 3
              ? 'LAGGING'
              : 'REALTIME';
      return {
        id: terminal.id,
        name: terminal.name,
        schoolName: terminal.schoolName,
        status,
        lastReceivedAt: terminal.pushLastReceivedAt,
        lastEventAt: terminal.pushLastEventAt,
        lagMinutes:
          status === 'LAGGING' && terminal.pushLastEventAt
            ? Math.max(
                0,
                Math.round((now - terminal.pushLastEventAt.getTime()) / 60_000),
              )
            : null,
      };
    });

    // Bugun terminal ulanishni uzgan (aborted) so‘rovlar: tarmog‘i beqaror terminallar.
    const abortedHash = await redis.hgetall(
      `${PUSH_ABORTED_KEY_PREFIX}${tashkentDate(new Date())}`,
    );
    const abortedCounts = Object.entries(abortedHash)
      .map(([id, value]) => ({ id: Number(id), count: Number(value) }))
      .filter((row) => Number.isInteger(row.id) && row.count > 0)
      .sort((a, b) => b.count - a.count);
    const abortedTop = abortedCounts.slice(0, 20);
    const abortedInfo =
      abortedTop.length > 0
        ? await this.dataSource.query<
            { id: number; name: string; schoolName: string | null }[]
          >(
            `SELECT t.id, t.name, s.name AS schoolName
               FROM terminals t LEFT JOIN schools s ON s.id = t.schoolId
              WHERE t.id IN (${abortedTop.map(() => '?').join(',')})`,
            abortedTop.map((row) => row.id),
          )
        : [];
    const aborted = {
      total: abortedCounts.reduce((sum, row) => sum + row.count, 0),
      terminals: abortedCounts.length,
      top: abortedTop.map((row) => {
        const info = abortedInfo.find((item) => item.id === row.id);
        return {
          id: row.id,
          name: info?.name ?? `#${row.id}`,
          schoolName: info?.schoolName ?? null,
          count: row.count,
        };
      }),
    };

    const count = (status: string) =>
      rows.filter((row) => row.status === status).length;

    return {
      aborted,
      terminals: {
        total: rows.length,
        realtime: count('REALTIME'),
        lagging: count('LAGGING'),
        idle: count('IDLE'),
        never: count('NEVER'),
      },
      // E’tibor talab qiladiganlar: avval kechikayotganlar (eng orqadagisi birinchi),
      // keyin hali bitta so‘rov yubormaganlar, keyin jim turganlar.
      attention: rows
        .filter((row) => row.status !== 'REALTIME')
        .sort(
          (a, b) =>
            ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status] ||
            (b.lagMinutes ?? 0) - (a.lagMinutes ?? 0),
        )
        .slice(0, 300),
      today: today.map((row) => ({
        source: String(row.source),
        received: Number(row.received),
        inserted: Number(row.inserted),
        duplicates: Number(row.duplicates),
        withPicture: Number(row.withPicture),
        withoutPicture: Number(row.withoutPicture),
        maxLagSeconds: Number(row.maxLagSeconds),
      })),
    };
  }
}
