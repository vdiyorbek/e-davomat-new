import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { str } from './str';

type Row = Record<string, unknown>;

export type ParentMessageKind = 'ARRIVED' | 'LEFT' | 'ABSENT' | 'EXCUSE';

export interface ParentChild {
  personId: number;
  firstName: string;
  lastName: string;
  schoolId: number;
  schoolName: string;
  className: string | null;
  hasPhoto: boolean;
  /** Maktab ota-onaga terminal rasmini ko‘rsatishga ruxsat bergan. */
  showEventPhotos: boolean;
}

const PREF_COLUMN: Record<ParentMessageKind, string> = {
  ARRIVED: 'notifyArrival',
  LEFT: 'notifyLeave',
  ABSENT: 'notifyAbsent',
  EXCUSE: 'notifyExcuse',
};

const TASHKENT = 'Asia/Tashkent';

export function tashkentParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TASHKENT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Telefon raqamining oxirgi 9 ta raqami (+998/8/bo‘shliqlarsiz) yoki null. */
export function phoneKeyOf(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/**
 * Ota-onalarga xabar: kim kimning ota-onasi (telefon bo‘yicha) va xabarlar navbati.
 * Faqat «sinov maktablari» (parent_notification_schools.enabled) hisobga olinadi.
 */
@Injectable()
export class ParentNotifyService {
  private readonly logger = new Logger(ParentNotifyService.name);
  private schoolsCache: { at: number; ids: Set<number> } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async enabledSchoolIds(): Promise<Set<number>> {
    if (this.schoolsCache && Date.now() - this.schoolsCache.at < 60_000) {
      return this.schoolsCache.ids;
    }
    const rows: Row[] = await this.dataSource.query(
      'SELECT schoolId FROM parent_notification_schools WHERE enabled = 1',
    );
    const ids = new Set(rows.map((row) => Number(row.schoolId)));
    this.schoolsCache = { at: Date.now(), ids };
    return ids;
  }

  invalidateSchools(): void {
    this.schoolsCache = null;
  }

  /** Telefon raqami bo‘yicha farzandlar (faqat sinov maktablaridagi faol o‘quvchilar). */
  async childrenOf(phoneKey: string): Promise<ParentChild[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT DISTINCT p.id AS personId, p.firstName, p.lastName,
              s.id AS schoolId, s.name AS schoolName, c.name AS className,
              (p.photoUrl IS NOT NULL) AS hasPhoto, ps.showEventPhotos
         FROM person_guardians g
         JOIN persons p ON p.id = g.personId AND p.deletedAt IS NULL
         JOIN school_memberships m ON m.personId = p.id AND m.type = 'STUDENT'
              AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE())
         JOIN parent_notification_schools ps ON ps.schoolId = m.schoolId AND ps.enabled = 1
         JOIN schools s ON s.id = m.schoolId
         LEFT JOIN school_classes c ON c.id = m.classId
        WHERE g.phoneKey = ?
        ORDER BY p.lastName, p.firstName`,
      [phoneKey],
    );
    return rows.map((row) => ({
      personId: Number(row.personId),
      firstName: str(row.firstName ?? ''),
      lastName: str(row.lastName ?? ''),
      schoolId: Number(row.schoolId),
      schoolName: str(row.schoolName ?? ''),
      className: row.className === null ? null : str(row.className),
      hasPhoto: Number(row.hasPhoto) === 1,
      showEventPhotos: Number(row.showEventPhotos) === 1,
    }));
  }

  /** Quiet hours: 21:00–07:00 (Toshkent) — ertalab 07:00 gacha kutadi. */
  sendAfter(now = new Date()): Date {
    const t = tashkentParts(now);
    if (t.hour >= 7 && t.hour < 21) return now;
    const day = t.hour >= 21 ? new Date(now.getTime() + 24 * 3600_000) : now;
    return new Date(`${tashkentParts(day).date}T07:00:00+05:00`);
  }

  /**
   * Shu farzandning ota-onalariga (telefon bo‘yicha bog‘langan Telegram akkauntlar) xabar qo‘yadi.
   * `dedupeKey` bir xil bo‘lsa takror yuborilmaydi.
   */
  async enqueue(
    personId: number,
    kind: ParentMessageKind,
    dedupeKey: string,
    payload: Record<string, string | number | null>,
  ): Promise<number> {
    const links: Row[] = await this.dataSource.query(
      `SELECT DISTINCT l.id FROM person_guardians g
         JOIN parent_telegram_links l ON l.phoneKey = g.phoneKey
        WHERE g.personId = ? AND l.blockedAt IS NULL AND l.${PREF_COLUMN[kind]} = 1
          AND EXISTS (
            SELECT 1 FROM school_memberships m
              JOIN parent_notification_schools ps ON ps.schoolId = m.schoolId AND ps.enabled = 1
             WHERE m.personId = g.personId AND m.type = 'STUDENT'
               AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE()))`,
      [personId],
    );
    if (links.length === 0) return 0;
    const after = this.sendAfter();
    let created = 0;
    for (const link of links) {
      const result = await this.dataSource.query<{ affectedRows: number }>(
        `INSERT IGNORE INTO parent_messages (linkId, kind, personId, dedupeKey, payload, sendAfter)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          Number(link.id),
          kind,
          personId,
          dedupeKey,
          JSON.stringify(payload),
          after,
        ],
      );
      created += Number(result.affectedRows ?? 0);
    }
    return created;
  }

  /** Ariza natijasi (tasdiqlandi/rad etildi) — ota-onaga. Xatolik asosiy jarayonni to‘xtatmaydi. */
  async notifyExcuseResult(input: {
    excuseId: number;
    personId: number;
    approved: boolean;
    from: string;
    to: string;
    reason?: string | null;
  }): Promise<void> {
    try {
      const [person]: Row[] = await this.dataSource.query(
        'SELECT firstName, lastName FROM persons WHERE id = ?',
        [input.personId],
      );
      if (!person) return;
      await this.enqueue(
        input.personId,
        'EXCUSE',
        `exc:${input.excuseId}:${input.approved ? 'ok' : 'no'}`,
        {
          name: `${str(person.lastName ?? '')} ${str(person.firstName ?? '')}`.trim(),
          approved: input.approved ? 1 : 0,
          from: input.from,
          to: input.to,
          reason: input.reason ?? null,
        },
      );
    } catch (error) {
      this.logger.warn(`Ariza xabari qo‘yilmadi: ${(error as Error).message}`);
    }
  }
}
