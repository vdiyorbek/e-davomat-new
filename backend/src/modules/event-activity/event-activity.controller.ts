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
      // E’tibor talab qiladiganlar: kechikayotganlari (eng orqadagisi birinchi) va jim turganlar.
      attention: rows
        .filter((row) => row.status === 'LAGGING' || row.status === 'IDLE')
        .sort(
          (a, b) =>
            Number(b.status === 'LAGGING') - Number(a.status === 'LAGGING') ||
            (b.lagMinutes ?? 0) - (a.lagMinutes ?? 0),
        )
        .slice(0, 50),
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
