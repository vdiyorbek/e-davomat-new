import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParentNotifyService } from './parent-notify.service';
import {
  TelegramApiService,
  TelegramError,
  telegramConfig,
} from './telegram-api.service';
import { str } from './str';

type Row = Record<string, unknown>;

@Injectable()
export class ParentAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly telegram: TelegramApiService,
    private readonly parents: ParentNotifyService,
  ) {}

  /** Bot sozlamasi va umumiy sonlar (token qaytarilmaydi). */
  async status() {
    const config = telegramConfig();
    let bot: { username: string | null } | null = null;
    let webhook: {
      url: string;
      pending: number;
      lastError: string | null;
    } | null = null;
    let error: string | null = null;
    if (this.telegram.configured) {
      try {
        const me = await this.telegram.call<{ username?: string }>('getMe');
        bot = { username: me.username ?? null };
        const info = await this.telegram.call<{
          url?: string;
          pending_update_count?: number;
          last_error_message?: string;
        }>('getWebhookInfo');
        webhook = {
          url: info.url ?? '',
          pending: info.pending_update_count ?? 0,
          lastError: info.last_error_message ?? null,
        };
      } catch (caught) {
        error =
          caught instanceof TelegramError
            ? caught.message
            : 'Telegramga ulanib bo‘lmadi';
      }
    }
    const [links]: Row[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total, SUM(blockedAt IS NOT NULL) AS blocked, SUM(phoneKey IS NOT NULL) AS withPhone
         FROM parent_telegram_links`,
    );
    const today: Row[] = await this.dataSource.query(
      `SELECT status, COUNT(*) AS total FROM parent_messages WHERE createdAt >= CURDATE() GROUP BY status`,
    );
    return {
      configured: this.telegram.configured,
      hasPublicUrl: config.publicUrl.startsWith('https://'),
      publicUrl: config.publicUrl || null,
      bot,
      webhook,
      error,
      links: {
        total: Number(links?.total ?? 0),
        blocked: Number(links?.blocked ?? 0),
        withPhone: Number(links?.withPhone ?? 0),
      },
      messagesToday: Object.fromEntries(
        today.map((row) => [str(row.status), Number(row.total)]),
      ),
    };
  }

  /** Webhook va bot buyruqlarini o‘rnatadi. */
  async setupWebhook() {
    const config = telegramConfig();
    if (!this.telegram.configured) {
      throw new BadRequestException(
        'Telegram token yoki maxfiy so‘z sozlanmagan (Tizim sozlamalari → Telegram bot ulanishi)',
      );
    }
    if (!config.publicUrl.startsWith('https://')) {
      throw new BadRequestException(
        'Ommaviy manzil (https://…) sozlanmagan (Tizim sozlamalari → Telegram bot ulanishi)',
      );
    }
    await this.telegram.call('setWebhook', {
      url: `${config.publicUrl}/api/telegram/webhook`,
      secret_token: config.secret,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
    });
    await this.telegram
      .call('setMyCommands', {
        commands: [
          { command: 'start', description: 'Boshlash / Start' },
          { command: 'settings', description: 'Xabarnomalar / Notifications' },
          { command: 'lang', description: 'Til / Language' },
          { command: 'app', description: 'Davomat / Attendance' },
        ],
      })
      .catch(() => undefined);
    return this.status();
  }

  async schools() {
    const rows: Row[] = await this.dataSource.query(
      `SELECT ps.schoolId, ps.enabled, TIME_FORMAT(ps.defaultAbsentTime, '%H:%i') AS absentTime,
              ps.graceMinutes, ps.showEventPhotos, s.name, d.name AS district,
              (SELECT COUNT(*) FROM school_memberships m
                WHERE m.schoolId = ps.schoolId AND m.type = 'STUDENT'
                  AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE())) AS students,
              (SELECT COUNT(DISTINCT l.id) FROM school_memberships m
                 JOIN person_guardians g ON g.personId = m.personId
                 JOIN parent_telegram_links l ON l.phoneKey = g.phoneKey
                WHERE m.schoolId = ps.schoolId AND m.type = 'STUDENT'
                  AND m.startDate <= CURDATE() AND (m.endDate IS NULL OR m.endDate > CURDATE())) AS linked
         FROM parent_notification_schools ps
         JOIN schools s ON s.id = ps.schoolId JOIN districts d ON d.id = s.districtId
        ORDER BY s.name`,
    );
    return rows.map((row) => ({
      schoolId: Number(row.schoolId),
      name: row.name,
      district: row.district,
      enabled: Number(row.enabled) === 1,
      absentTime: row.absentTime,
      graceMinutes: Number(row.graceMinutes),
      showEventPhotos: Number(row.showEventPhotos) === 1,
      students: Number(row.students),
      linked: Number(row.linked),
    }));
  }

  async saveSchool(
    schoolId: number,
    body: {
      enabled?: unknown;
      absentTime?: unknown;
      graceMinutes?: unknown;
      showEventPhotos?: unknown;
    },
  ) {
    const [school]: Row[] = await this.dataSource.query(
      'SELECT id FROM schools WHERE id = ?',
      [schoolId],
    );
    if (!school) throw new NotFoundException('Maktab topilmadi');
    const enabled = body.enabled === undefined ? true : body.enabled === true;
    const time =
      typeof body.absentTime === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(body.absentTime)
        ? body.absentTime
        : '09:30';
    // Berilmasa — mavjud qiymat saqlanadi (null).
    const showPhotos =
      typeof body.showEventPhotos === 'boolean'
        ? body.showEventPhotos
          ? 1
          : 0
        : null;
    const grace = Number.isInteger(body.graceMinutes)
      ? Math.min(Math.max(Number(body.graceMinutes), 0), 180)
      : 30;
    await this.dataSource.query(
      `INSERT INTO parent_notification_schools (schoolId, enabled, defaultAbsentTime, graceMinutes, showEventPhotos)
       VALUES (?, ?, ?, ?, COALESCE(?, 0))
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), defaultAbsentTime = VALUES(defaultAbsentTime),
                               graceMinutes = VALUES(graceMinutes),
                               showEventPhotos = COALESCE(?, showEventPhotos)`,
      [schoolId, enabled ? 1 : 0, `${time}:00`, grace, showPhotos, showPhotos],
    );
    this.parents.invalidateSchools();
    return (await this.schools()).find((item) => item.schoolId === schoolId);
  }

  /**
   * Barcha maktablar uchun yoqish. Allaqachon sozlangan maktablarning vaqti va
   * «terminal rasmi» tanlovi o‘zgarmaydi; yangilari standart qiymatlar bilan
   * qo‘shiladi (terminal rasmi — o‘chiq).
   */
  async enableAllSchools() {
    await this.dataSource.query(
      `INSERT INTO parent_notification_schools (schoolId, enabled, defaultAbsentTime, graceMinutes, showEventPhotos)
       SELECT id, 1, '09:30:00', 30, 0 FROM schools
       ON DUPLICATE KEY UPDATE enabled = 1`,
    );
    this.parents.invalidateSchools();
    const list = await this.schools();
    return {
      enabled: list.filter((item) => item.enabled).length,
      total: list.length,
    };
  }

  /** Oxirgi xabarlar (telefon yoki chat identifikatorlarisiz). */
  async messages(limit: number) {
    const rows: Row[] = await this.dataSource.query(
      `SELECT m.id, m.kind, m.status, m.attempts, m.error, m.createdAt, m.sentAt, p.lastName, p.firstName
         FROM parent_messages m LEFT JOIN persons p ON p.id = m.personId
        ORDER BY m.id DESC LIMIT ?`,
      [limit],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      kind: row.kind,
      status: row.status,
      attempts: Number(row.attempts),
      error: row.error ?? null,
      createdAt: row.createdAt,
      sentAt: row.sentAt ?? null,
      student: `${str(row.lastName ?? '')} ${str(row.firstName ?? '')}`.trim(),
    }));
  }
}
