import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';

const MAX_RECIPIENTS = 5000;
const REMIND_AFTER_DAYS = 3;

type Row = Record<string, unknown>;

function fullName(row: Row): string {
  return [row.lastName, row.firstName]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(' ');
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── Yuborish ─────────────

  async create(dto: CreateAnnouncementDto, actor: AuthenticatedUser) {
    const recipientIds = await this.resolveRecipients(dto, actor);
    if (recipientIds.length === 0) {
      throw new BadRequestException(
        'Tanlangan hudud va rollar bo‘yicha qabul qiluvchi topilmadi',
      );
    }
    if (recipientIds.length > MAX_RECIPIENTS) {
      throw new BadRequestException(
        `Qabul qiluvchilar juda ko‘p (${recipientIds.length}). Hududni toraytiring`,
      );
    }
    if (dto.kind === 'TASK' && dto.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (dto.dueDate < today) {
        throw new BadRequestException('Muddat o‘tib ketgan sana bo‘lmasin');
      }
    }

    const audience = {
      scope: dto.scope,
      regionId: dto.regionId ?? null,
      districtId: dto.districtId ?? null,
      schoolIds: dto.schoolIds ?? [],
      roles: dto.roles,
    };
    const id = await this.publish(actor, {
      kind: dto.kind,
      title: dto.title,
      body: dto.body,
      linkPath: dto.linkPath ?? null,
      dueDate: dto.kind === 'TASK' ? (dto.dueDate ?? null) : null,
      audience,
      recipientIds,
    });

    return { id, recipients: recipientIds.length };
  }

  /** Xabarni saqlaydi va qabul qiluvchilarga bildirishnoma yuboradi. */
  private async publish(
    actor: AuthenticatedUser,
    input: {
      kind: string;
      title: string;
      body: string;
      linkPath: string | null;
      dueDate: string | null;
      audience: Record<string, unknown>;
      recipientIds: number[];
    },
  ): Promise<number> {
    const insert = await this.dataSource.query<{ insertId: number }>(
      `INSERT INTO announcements
         (senderUserId, kind, title, body, linkPath, dueDate, audience, recipientCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.id,
        input.kind,
        input.title,
        input.body,
        input.linkPath,
        input.dueDate,
        JSON.stringify(input.audience),
        input.recipientIds.length,
      ],
    );
    const id = Number(insert.insertId);
    const sender = fullName(actor as unknown as Row) || actor.login;

    await this.notifications.notify(
      input.recipientIds.map((userId) => ({
        userId,
        type: 'ANNOUNCEMENT' as const,
        payload: {
          announcementId: id,
          kind: input.kind,
          title: input.title,
          body: input.body,
          linkPath: input.linkPath,
          dueDate: input.dueDate,
          sender,
        },
        dedupeKey: `ann:${id}`,
      })),
    );
    await this.linkRecipients(id, input.recipientIds);
    return id;
  }

  /** Qabul qiluvchilar qatorlarini yaratadi va ularni bildirishnomalarga bog‘laydi. */
  private async linkRecipients(id: number, userIds: number[]) {
    for (let i = 0; i < userIds.length; i += 500) {
      const chunk = userIds.slice(i, i + 500);
      await this.dataSource.query(
        `INSERT IGNORE INTO announcement_recipients (announcementId, userId, notificationId)
         SELECT ?, n.userId, n.id FROM notifications n
          WHERE n.dedupeKey = ? AND n.userId IN (${chunk.map(() => '?').join(',')})`,
        [id, `ann:${id}`, ...chunk],
      );
    }
  }

  private async resolveRecipients(
    dto: CreateAnnouncementDto,
    actor: AuthenticatedUser,
  ): Promise<number[]> {
    const isSuper = actor.role === UserRole.SUPER_ADMIN;
    if (!isSuper && actor.role !== UserRole.REGION_ADMIN) {
      throw new ForbiddenException('Xabar yuborishga ruxsat yo‘q');
    }
    if (!isSuper && dto.roles.includes('REGION_ADMIN')) {
      throw new ForbiddenException(
        'Viloyat administratorlariga faqat Bosh administrator yozadi',
      );
    }

    const where: string[] = [
      'u.isActive = 1',
      `u.role IN (${dto.roles.map(() => '?').join(',')})`,
      'u.id <> ?',
    ];
    const params: unknown[] = [...dto.roles, actor.id];
    // Foydalanuvchining viloyat/tuman/maktabi: o‘z ustunlari yoki maktab orqali.
    const regionExpr = 'COALESCE(u.regionId, d.regionId)';
    const districtExpr = 'COALESCE(u.districtId, s.districtId)';

    let regionLimit: number | null = null;
    if (!isSuper) {
      if (actor.regionId === null || actor.regionId === undefined) {
        throw new ForbiddenException('Viloyatingiz aniqlanmadi');
      }
      regionLimit = actor.regionId;
    }

    switch (dto.scope) {
      case 'ALL':
        if (!isSuper) {
          throw new ForbiddenException(
            'Butun tizimga faqat Bosh administrator yozadi',
          );
        }
        break;
      case 'REGION': {
        const regionId = isSuper ? dto.regionId : regionLimit;
        if (!regionId) throw new BadRequestException('Viloyatni tanlang');
        where.push(`${regionExpr} = ?`);
        params.push(regionId);
        break;
      }
      case 'DISTRICT': {
        if (!dto.districtId) throw new BadRequestException('Tumanni tanlang');
        if (regionLimit !== null) {
          const [row]: Row[] = await this.dataSource.query(
            'SELECT id FROM districts WHERE id = ? AND regionId = ?',
            [dto.districtId, regionLimit],
          );
          if (!row) {
            throw new ForbiddenException(
              'Bu tuman sizning viloyatingizda emas',
            );
          }
        }
        where.push(`${districtExpr} = ?`);
        params.push(dto.districtId);
        break;
      }
      case 'SCHOOLS': {
        const ids = [...new Set(dto.schoolIds ?? [])];
        if (ids.length === 0) throw new BadRequestException('Maktabni tanlang');
        if (regionLimit !== null) {
          const rows: Row[] = await this.dataSource.query(
            `SELECT sc.id FROM schools sc JOIN districts di ON di.id = sc.districtId
              WHERE sc.id IN (${ids.map(() => '?').join(',')}) AND di.regionId = ?`,
            [...ids, regionLimit],
          );
          if (rows.length !== ids.length) {
            throw new ForbiddenException(
              'Tanlangan maktablardan biri sizning viloyatingizda emas',
            );
          }
        }
        // Mahalla inspektorlari maktabga emas, tumanga biriktirilgan: tanlangan
        // maktablar joylashgan tumanlardagi inspektorlar ham qabul qiladi.
        const marks = ids.map(() => '?').join(',');
        where.push(
          `(u.schoolId IN (${marks}) OR (u.role = 'MAHALLA_INSPECTOR' AND u.districtId IN (SELECT districtId FROM schools WHERE id IN (${marks}))))`,
        );
        params.push(...ids, ...ids);
        break;
      }
    }

    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT u.id FROM users u
         LEFT JOIN schools s ON s.id = u.schoolId
         LEFT JOIN districts d ON d.id = COALESCE(u.districtId, s.districtId)
        WHERE ${where.join(' AND ')}
        LIMIT ${MAX_RECIPIENTS + 1}`,
      params,
    );
    return rows.map((row) => Number(row.id));
  }

  // ───────────── Yuborilganlar ro‘yxati va holat ─────────────

  async list(actor: AuthenticatedUser, page: number, limit: number) {
    const own =
      actor.role === UserRole.SUPER_ADMIN ? '' : 'WHERE a.senderUserId = ?';
    const params: unknown[] =
      actor.role === UserRole.SUPER_ADMIN ? [] : [actor.id];
    const [count]: { total: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM announcements a ${own}`,
      params,
    );
    const rows: Row[] = await this.dataSource.query(
      `SELECT a.id, a.kind, a.title, DATE_FORMAT(a.dueDate, '%Y-%m-%d') AS dueDate, a.recipientCount, a.createdAt,
              u.firstName AS senderFirst, u.lastName AS senderLast, u.login AS senderLogin,
              (SELECT COUNT(*) FROM announcement_recipients r
                 JOIN notifications n ON n.id = r.notificationId
                WHERE r.announcementId = a.id AND n.readAt IS NOT NULL) AS readCount,
              (SELECT COUNT(*) FROM announcement_recipients r
                WHERE r.announcementId = a.id AND r.doneAt IS NOT NULL) AS doneCount
         FROM announcements a LEFT JOIN users u ON u.id = a.senderUserId
         ${own}
        ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    return {
      total: Number(count?.total ?? 0),
      page,
      limit,
      items: rows.map((row) => ({
        id: Number(row.id),
        kind: row.kind,
        title: row.title,
        dueDate: row.dueDate,
        recipients: Number(row.recipientCount),
        read: Number(row.readCount),
        done: Number(row.doneCount),
        createdAt: row.createdAt,
        sender:
          fullName({
            firstName: row.senderFirst,
            lastName: row.senderLast,
          }) || (typeof row.senderLogin === 'string' ? row.senderLogin : ''),
      })),
    };
  }

  async detail(id: number, actor: AuthenticatedUser) {
    const [announcement]: Row[] = await this.dataSource.query(
      `SELECT id, senderUserId, kind, title, body, linkPath, DATE_FORMAT(dueDate, '%Y-%m-%d') AS dueDate, audience, recipientCount, remindedAt, createdAt
         FROM announcements WHERE id = ?`,
      [id],
    );
    if (
      !announcement ||
      (actor.role !== UserRole.SUPER_ADMIN &&
        Number(announcement.senderUserId) !== actor.id)
    ) {
      throw new NotFoundException('Xabar topilmadi');
    }
    const recipients: Row[] = await this.dataSource.query(
      `SELECT u.id, u.firstName, u.lastName, u.role, s.name AS schoolName,
              n.readAt, r.doneAt
         FROM announcement_recipients r
         JOIN users u ON u.id = r.userId
         LEFT JOIN schools s ON s.id = u.schoolId
         LEFT JOIN notifications n ON n.id = r.notificationId
        WHERE r.announcementId = ?
        ORDER BY (r.doneAt IS NULL) DESC, (n.readAt IS NULL) DESC, u.lastName
        LIMIT 1000`,
      [id],
    );
    return {
      ...announcement,
      id: Number(announcement.id),
      recipients: recipients.map((row) => ({
        userId: Number(row.id),
        name: fullName(row),
        role: row.role,
        school: row.schoolName ?? null,
        readAt: row.readAt ?? null,
        doneAt: row.doneAt ?? null,
      })),
    };
  }

  // ───────────── Qabul qiluvchi: «Bajarildi» ─────────────

  async markDone(announcementId: number, userId: number): Promise<void> {
    const [row]: { id: number; notificationId: number | null }[] =
      await this.dataSource.query(
        `SELECT id, notificationId FROM announcement_recipients
          WHERE announcementId = ? AND userId = ?`,
        [announcementId, userId],
      );
    if (!row) throw new NotFoundException('Topshiriq topilmadi');
    await this.dataSource.query(
      'UPDATE announcement_recipients SET doneAt = COALESCE(doneAt, NOW(3)) WHERE id = ?',
      [row.id],
    );
    if (row.notificationId) {
      await this.notifications.markRead(userId, Number(row.notificationId));
    }
  }

  // ───────────── Avtomatik eslatma (3 kundan keyin, bir marta) ─────────────

  @Cron('0 0 9 * * *', { timeZone: 'Asia/Tashkent' })
  async remindOverdue(): Promise<void> {
    try {
      const due: Row[] = await this.dataSource.query(
        `SELECT id, title, linkPath FROM announcements
          WHERE kind = 'TASK' AND remindedAt IS NULL
            AND createdAt < DATE_SUB(NOW(), INTERVAL ${REMIND_AFTER_DAYS} DAY)`,
      );
      for (const announcement of due) {
        const id = Number(announcement.id);
        const pending: { userId: number }[] = await this.dataSource.query(
          `SELECT userId FROM announcement_recipients
            WHERE announcementId = ? AND doneAt IS NULL`,
          [id],
        );
        await this.notifications.notify(
          pending.map((row) => ({
            userId: Number(row.userId),
            type: 'ANNOUNCEMENT_REMINDER' as const,
            payload: {
              announcementId: id,
              title: String(announcement.title),
              linkPath: (announcement.linkPath as string | null) ?? null,
            },
            dedupeKey: `annrem:${id}`,
          })),
        );
        await this.dataSource.query(
          'UPDATE announcements SET remindedAt = NOW(3) WHERE id = ?',
          [id],
        );
      }
    } catch (error) {
      this.logger.error(`Eslatma yuborilmadi: ${(error as Error).message}`);
    }
  }

  // ───────────── Ma’lumot to‘liq emas: avtomatik eslatma ─────────────

  private gapCounts(schoolId?: number) {
    return `SELECT s.id AS schoolId, s.name AS schoolName, d.name AS districtName,
                   COUNT(*) AS students,
                   SUM(p.photoUrl IS NULL OR p.photoUrl = '') AS noPhoto,
                   SUM(NOT EXISTS (
                     SELECT 1 FROM person_guardians g
                      WHERE g.personId = p.id AND g.phoneNumber IS NOT NULL AND g.phoneNumber <> ''
                   )) AS noGuardian
              FROM school_memberships m
              JOIN persons p ON p.id = m.personId AND p.deletedAt IS NULL
              JOIN schools s ON s.id = m.schoolId
              JOIN districts d ON d.id = s.districtId
             WHERE m.type = 'STUDENT' AND m.startDate <= CURDATE()
               AND (m.endDate IS NULL OR m.endDate > CURDATE())
               ${schoolId ? 'AND s.id = ?' : '{SCOPE}'}
             GROUP BY s.id, s.name, d.name`;
  }

  private scopeSql(actor: AuthenticatedUser, regionId?: number) {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return regionId
        ? { sql: 'AND d.regionId = ?', params: [regionId] }
        : { sql: '', params: [] as unknown[] };
    }
    if (actor.role === UserRole.REGION_ADMIN && actor.regionId) {
      return { sql: 'AND d.regionId = ?', params: [actor.regionId] };
    }
    throw new ForbiddenException('Ruxsat yo‘q');
  }

  /** Kamchiligi bor maktablar: rasmi yo‘q va ota-ona telefoni yo‘q o‘quvchilar soni. */
  async dataGaps(actor: AuthenticatedUser, regionId?: number) {
    const scope = this.scopeSql(actor, regionId);
    const rows: Row[] = await this.dataSource.query(
      `${this.gapCounts().replace('{SCOPE}', scope.sql)}
       HAVING noPhoto > 0 OR noGuardian > 0
       ORDER BY noPhoto DESC, noGuardian DESC LIMIT 500`,
      scope.params,
    );
    const open = await this.openAutoReminders();
    return rows.map((row) => {
      const schoolId = Number(row.schoolId);
      return {
        schoolId,
        school: row.schoolName,
        district: row.districtName,
        students: Number(row.students),
        noPhoto: Number(row.noPhoto),
        noGuardian: Number(row.noGuardian),
        photoSent: open.has(`PHOTO:${schoolId}`),
        guardianSent: open.has(`GUARDIAN:${schoolId}`),
      };
    });
  }

  /** Hali bajarilmagan avtomatik eslatmalar: «GAP:schoolId» to‘plami. */
  private async openAutoReminders(): Promise<Set<string>> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(a.audience, '$.auto.gap')) AS gap,
              JSON_EXTRACT(a.audience, '$.auto.schoolId') AS schoolId
         FROM announcements a
        WHERE JSON_EXTRACT(a.audience, '$.auto.gap') IS NOT NULL
          AND EXISTS (SELECT 1 FROM announcement_recipients r
                       WHERE r.announcementId = a.id AND r.doneAt IS NULL)`,
    );
    return new Set(
      rows.map((row) => `${String(row.gap)}:${Number(row.schoolId)}`),
    );
  }

  /** Maktab administratorlariga kamchilik bo‘yicha topshiriq yuboradi (ochiq eslatmasi borlarga — yo‘q). */
  async notifyGaps(
    actor: AuthenticatedUser,
    gap: 'PHOTO' | 'GUARDIAN',
    schoolIds: number[] | undefined,
    regionId?: number,
  ) {
    const all = await this.dataGaps(actor, regionId);
    const picked = schoolIds ? new Set(schoolIds) : null;
    let sent = 0;
    let skippedOpen = 0;
    let skippedNoAdmin = 0;

    for (const row of all) {
      if (picked && !picked.has(row.schoolId)) continue;
      const count = gap === 'PHOTO' ? row.noPhoto : row.noGuardian;
      if (count === 0) continue;
      if (gap === 'PHOTO' ? row.photoSent : row.guardianSent) {
        skippedOpen += 1;
        continue;
      }
      const admins: { id: number }[] = await this.dataSource.query(
        `SELECT id FROM users WHERE role = ? AND schoolId = ? AND isActive = 1`,
        [UserRole.SCHOOL_ADMIN, row.schoolId],
      );
      if (admins.length === 0) {
        skippedNoAdmin += 1;
        continue;
      }
      await this.publish(actor, {
        kind: 'TASK',
        title:
          gap === 'PHOTO'
            ? `${String(row.school)}: ${count} ta o‘quvchining rasmi yo‘q`
            : `${String(row.school)}: ${count} ta o‘quvchining ota-ona telefoni kiritilmagan`,
        body:
          gap === 'PHOTO'
            ? 'Iltimos, o‘quvchilar ro‘yxatidan rasmi yo‘qlarini topib, rasm yuklang. Hammasi to‘ldirilgach topshiriq o‘zi bajarilgan deb belgilanadi.'
            : 'Iltimos, o‘quvchilar kartochkasiga ota yoki onasining telefon raqamini kiriting. Hammasi to‘ldirilgach topshiriq o‘zi bajarilgan deb belgilanadi.',
        linkPath: '/students',
        dueDate: null,
        audience: {
          scope: 'SCHOOLS',
          schoolIds: [row.schoolId],
          roles: ['SCHOOL_ADMIN'],
          auto: { gap, schoolId: row.schoolId, count },
        },
        recipientIds: admins.map((admin) => Number(admin.id)),
      });
      sent += 1;
    }
    return { sent, skippedOpen, skippedNoAdmin };
  }

  /** Kamchilik tugagan bo‘lsa, avtomatik topshiriqni o‘zi «bajarildi» qiladi (har 30 daqiqada). */
  @Cron('0 */30 * * * *', { timeZone: 'Asia/Tashkent' })
  async resolveAutoReminders(): Promise<void> {
    try {
      const open: Row[] = await this.dataSource.query(
        `SELECT a.id,
                JSON_UNQUOTE(JSON_EXTRACT(a.audience, '$.auto.gap')) AS gap,
                JSON_EXTRACT(a.audience, '$.auto.schoolId') AS schoolId
           FROM announcements a
          WHERE JSON_EXTRACT(a.audience, '$.auto.gap') IS NOT NULL
            AND EXISTS (SELECT 1 FROM announcement_recipients r
                         WHERE r.announcementId = a.id AND r.doneAt IS NULL)
          LIMIT 500`,
      );
      for (const announcement of open) {
        const schoolId = Number(announcement.schoolId);
        const [row]: Row[] = await this.dataSource.query(
          `SELECT * FROM (${this.gapCounts(schoolId)}) t`,
          [schoolId],
        );
        const remaining =
          announcement.gap === 'PHOTO'
            ? Number(row?.noPhoto ?? 0)
            : Number(row?.noGuardian ?? 0);
        if (remaining > 0) continue;
        const id = Number(announcement.id);
        await this.dataSource.query(
          `UPDATE notifications n
             JOIN announcement_recipients r ON r.notificationId = n.id
              SET n.readAt = COALESCE(n.readAt, NOW(3))
            WHERE r.announcementId = ? AND r.doneAt IS NULL`,
          [id],
        );
        await this.dataSource.query(
          'UPDATE announcement_recipients SET doneAt = NOW(3) WHERE announcementId = ? AND doneAt IS NULL',
          [id],
        );
      }
    } catch (error) {
      this.logger.error(
        `Avto-eslatmalarni yopib bo‘lmadi: ${(error as Error).message}`,
      );
    }
  }
}
