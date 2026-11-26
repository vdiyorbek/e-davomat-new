import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  BROADCAST_TYPES,
  isBroadcastType,
  type BroadcastTexts,
} from './parent-broadcast-texts';
import { ParentNotifyService } from './parent-notify.service';
import { PARENT_LANGUAGES } from './parent-texts';
import { str } from './str';

type Row = Record<string, unknown>;

const MAX_TITLE = 120;
const MAX_BODY = 3000;

export type BroadcastScope = 'ALL' | 'REGION' | 'DISTRICT' | 'SCHOOL' | 'CLASS';

export interface BroadcastAudience {
  scope: BroadcastScope;
  regionId?: number;
  districtId?: number;
  schoolId?: number;
  classId?: number;
}

function positiveInt(value: unknown, name: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1)
    throw new BadRequestException(`${name} noto‘g‘ri`);
  return n;
}

export function parseAudience(raw: unknown): BroadcastAudience {
  const input = (raw ?? {}) as Record<string, unknown>;
  switch (input.scope) {
    case 'ALL':
      return { scope: 'ALL' };
    case 'REGION':
      return {
        scope: 'REGION',
        regionId: positiveInt(input.regionId, 'Viloyat'),
      };
    case 'DISTRICT':
      return {
        scope: 'DISTRICT',
        districtId: positiveInt(input.districtId, 'Tuman'),
      };
    case 'SCHOOL':
      return {
        scope: 'SCHOOL',
        schoolId: positiveInt(input.schoolId, 'Maktab'),
      };
    case 'CLASS':
      return { scope: 'CLASS', classId: positiveInt(input.classId, 'Sinf') };
    default:
      throw new BadRequestException('Qabul qiluvchilar turi noto‘g‘ri');
  }
}

/** Faol o‘quvchilarning ota-ona telefonlari (maktab/tuman/viloyat/sinf bo‘yicha). */
export function audienceQuery(audience: BroadcastAudience): {
  from: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (audience.scope === 'REGION') {
    conditions.push('d.regionId = ?');
    params.push(audience.regionId);
  } else if (audience.scope === 'DISTRICT') {
    conditions.push('s.districtId = ?');
    params.push(audience.districtId);
  } else if (audience.scope === 'SCHOOL') {
    conditions.push('m.schoolId = ?');
    params.push(audience.schoolId);
  } else if (audience.scope === 'CLASS') {
    conditions.push('m.classId = ?');
    params.push(audience.classId);
  }
  const from = `FROM person_guardians g
      JOIN persons p ON p.id = g.personId AND p.deletedAt IS NULL
      JOIN school_memberships m ON m.personId = g.personId AND m.type = 'STUDENT'
           AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE())
      JOIN schools s ON s.id = m.schoolId
      JOIN districts d ON d.id = s.districtId
     WHERE g.phoneKey IS NOT NULL${conditions.map((c) => ` AND ${c}`).join('')}`;
  return { from, params };
}

function cleanTexts(raw: unknown): BroadcastTexts {
  if (typeof raw !== 'object' || raw === null)
    throw new BadRequestException('Xabar matni berilmagan');
  const result: BroadcastTexts = {};
  for (const language of PARENT_LANGUAGES) {
    const entry = (raw as Record<string, unknown>)[language];
    if (typeof entry !== 'object' || entry === null) continue;
    const title = str((entry as Record<string, unknown>).title ?? '').trim();
    const body = str((entry as Record<string, unknown>).body ?? '').trim();
    if (!title && !body) continue;
    if (title.length > MAX_TITLE)
      throw new BadRequestException(
        `Sarlavha ${MAX_TITLE} belgidan oshmasligi kerak`,
      );
    if (body.length > MAX_BODY)
      throw new BadRequestException(
        `Matn ${MAX_BODY} belgidan oshmasligi kerak`,
      );
    if (!body)
      throw new BadRequestException(
        `${language}: matn bo‘sh bo‘lmasligi kerak`,
      );
    result[language] = { title: title || undefined, body };
  }
  if (!result.uz?.body || result.uz.body.length < 3)
    throw new BadRequestException(
      'O‘zbekcha matn majburiy (boshqa tilda matn bo‘lmasa shu yuboriladi)',
    );
  return result;
}

/** Bosh administrator: ota-onalarga e‘lon va boshqa xabarlar (Telegram orqali). */
@Injectable()
export class ParentBroadcastService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly parents: ParentNotifyService,
  ) {}

  async preview(rawAudience: unknown) {
    const audience = parseAudience(rawAudience);
    const { from, params } = audienceQuery(audience);
    const [counts]: Row[] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT g.phoneKey) AS phones, COUNT(DISTINCT p.id) AS children,
              COUNT(DISTINCT s.id) AS schools ${from}`,
      params,
    );
    const [reach]: Row[] = await this.dataSource.query(
      `SELECT COUNT(*) AS reachable FROM parent_telegram_links l
        WHERE l.blockedAt IS NULL AND l.notifyNews = 1
          AND l.phoneKey IN (SELECT g.phoneKey ${from})`,
      params,
    );
    return {
      audience,
      schools: Number(counts?.schools ?? 0),
      children: Number(counts?.children ?? 0),
      phones: Number(counts?.phones ?? 0),
      reachable: Number(reach?.reachable ?? 0),
    };
  }

  async create(
    userId: number,
    body: { type?: unknown; texts?: unknown; audience?: unknown },
  ) {
    if (!isBroadcastType(body.type))
      throw new BadRequestException(
        `Xabar turi noto‘g‘ri (${BROADCAST_TYPES.join(', ')})`,
      );
    const type = body.type;
    const texts = cleanTexts(body.texts);
    const audience = parseAudience(body.audience);
    const urgent = type === 'URGENT';
    const { from, params } = audienceQuery(audience);
    // Shoshilinch xabar darhol; qolganlari tungi (21:00–07:00) tinchlik vaqtini hisobga oladi.
    const sendAfter = urgent ? new Date() : this.parents.sendAfter();

    const id = await this.dataSource.transaction(async (manager) => {
      const result = await manager.query<{ insertId: number }>(
        `INSERT INTO parent_broadcasts (type, texts, audience, urgent, createdByUserId)
         VALUES (?, ?, ?, ?, ?)`,
        [
          type,
          JSON.stringify(texts),
          JSON.stringify(audience),
          urgent ? 1 : 0,
          userId,
        ],
      );
      const broadcastId = Number(result.insertId);
      const queued = await manager.query<{ affectedRows: number }>(
        `INSERT IGNORE INTO parent_messages (linkId, kind, personId, dedupeKey, payload, sendAfter)
         SELECT l.id, 'BROADCAST', 0, ?, ?, ?
           FROM parent_telegram_links l
          WHERE l.blockedAt IS NULL AND l.notifyNews = 1
            AND l.phoneKey IN (SELECT g.phoneKey ${from})`,
        [
          `bc:${broadcastId}`,
          JSON.stringify({ broadcastId }),
          sendAfter,
          ...params,
        ],
      );
      if (Number(queued.affectedRows ?? 0) === 0)
        throw new BadRequestException(
          'Tanlangan guruhda Telegram’ga ulangan ota-ona yo‘q — yuboriladigan hech kim topilmadi',
        );
      return broadcastId;
    });
    return (await this.list(1, id))[0];
  }

  async cancel(id: number) {
    const [row]: Row[] = await this.dataSource.query(
      'SELECT id FROM parent_broadcasts WHERE id = ?',
      [id],
    );
    if (!row) throw new NotFoundException('Xabar topilmadi');
    await this.dataSource.query(
      'UPDATE parent_broadcasts SET canceledAt = COALESCE(canceledAt, NOW(3)) WHERE id = ?',
      [id],
    );
    await this.dataSource.query(
      "UPDATE parent_messages SET status = 'SKIPPED', error = 'bekor qilindi' WHERE dedupeKey = ? AND status = 'PENDING'",
      [`bc:${id}`],
    );
    return (await this.list(1, id))[0];
  }

  private async audienceName(audience: BroadcastAudience): Promise<string> {
    const lookup = async (sql: string, id: number | undefined) => {
      const [row]: Row[] = await this.dataSource.query(sql, [id]);
      return row ? str(row.name ?? '') : '';
    };
    switch (audience.scope) {
      case 'REGION':
        return lookup(
          'SELECT name FROM regions WHERE id = ?',
          audience.regionId,
        );
      case 'DISTRICT':
        return lookup(
          'SELECT name FROM districts WHERE id = ?',
          audience.districtId,
        );
      case 'SCHOOL':
        return lookup(
          'SELECT name FROM schools WHERE id = ?',
          audience.schoolId,
        );
      case 'CLASS':
        return lookup(
          `SELECT CONCAT(s.name, ' · ', c.name) AS name FROM school_classes c
             JOIN schools s ON s.id = c.schoolId WHERE c.id = ?`,
          audience.classId,
        );
      default:
        return '';
    }
  }

  /** Oxirgi xabarlar va ularning holati (yuborildi/kutmoqda/xato). */
  async list(limit = 20, onlyId?: number) {
    const rows: Row[] = await this.dataSource.query(
      `SELECT id, type, texts, audience, urgent, canceledAt, createdAt
         FROM parent_broadcasts ${onlyId ? 'WHERE id = ?' : ''}
        ORDER BY id DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
      onlyId ? [onlyId] : [],
    );
    if (rows.length === 0) return [];
    const keys = rows.map((row) => `bc:${Number(row.id)}`);
    const counts: Row[] = await this.dataSource.query(
      `SELECT dedupeKey, status, COUNT(*) AS n FROM parent_messages
        WHERE dedupeKey IN (?) GROUP BY dedupeKey, status`,
      [keys],
    );
    const byKey = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const key = str(row.dedupeKey);
      byKey.set(key, { ...byKey.get(key), [str(row.status)]: Number(row.n) });
    }
    const json = <T>(value: unknown): T =>
      (typeof value === 'string' ? JSON.parse(value) : value) as T;
    const result: Record<string, unknown>[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      const stat = byKey.get(`bc:${id}`) ?? {};
      const texts = json<BroadcastTexts>(row.texts);
      const audience = json<BroadcastAudience>(row.audience);
      const pending = stat.PENDING ?? 0;
      result.push({
        id,
        type: str(row.type),
        title: texts.uz?.title ?? null,
        preview: (texts.uz?.body ?? '').slice(0, 160),
        languages: Object.keys(texts),
        audience,
        audienceName: await this.audienceName(audience),
        urgent: Number(row.urgent) === 1,
        createdAt: row.createdAt,
        canceledAt: row.canceledAt,
        total: Object.values(stat).reduce((sum, n) => sum + n, 0),
        sent: stat.SENT ?? 0,
        pending,
        failed: stat.FAILED ?? 0,
        skipped: stat.SKIPPED ?? 0,
        status: row.canceledAt ? 'CANCELED' : pending > 0 ? 'SENDING' : 'DONE',
      });
    }
    return result;
  }
}
