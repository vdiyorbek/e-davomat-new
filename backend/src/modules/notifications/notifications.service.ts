import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { UserRole } from '../users/enums/user-role.enum';

export type NotificationType =
  | 'EXCUSE_SUBMITTED'
  | 'EXCUSE_APPROVED'
  | 'EXCUSE_REJECTED'
  | 'ABSENT_STREAK'
  | 'SYSTEM_ALERT'
  | 'SYSTEM_RECOVERED';

export interface NewNotification {
  userId: number;
  type: NotificationType;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Bildirishnoma yuborish. Xatolik asosiy jarayonni to‘xtatmaydi. */
  async notify(items: NewNotification[]): Promise<void> {
    if (items.length === 0) return;
    try {
      for (let i = 0; i < items.length; i += 200) {
        const chunk = items.slice(i, i + 200);
        await this.dataSource.query(
          `INSERT IGNORE INTO notifications (userId, type, payload, dedupeKey)
           VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')}`,
          chunk.flatMap((n) => [
            n.userId,
            n.type,
            n.payload ? JSON.stringify(n.payload) : null,
            n.dedupeKey ?? null,
          ]),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Bildirishnoma yuborilmadi: ${(error as Error).message}`,
      );
    }
  }

  /** Maktabning faol maktab administratorlari. */
  async schoolAdminIds(schoolId: number): Promise<number[]> {
    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT id FROM users WHERE role = ? AND schoolId = ? AND isActive = 1`,
      [UserRole.SCHOOL_ADMIN, schoolId],
    );
    return rows.map((r) => Number(r.id));
  }

  async list(userId: number, limit: number, onlyUnread: boolean) {
    const rows: {
      id: number;
      type: string;
      payload: unknown;
      readAt: Date | null;
      createdAt: Date;
    }[] = await this.dataSource.query(
      `SELECT id, type, payload, readAt, createdAt FROM notifications
        WHERE userId = ? ${onlyUnread ? 'AND readAt IS NULL' : ''}
        ORDER BY id DESC LIMIT ?`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      type: r.type,
      payload:
        typeof r.payload === 'string'
          ? (JSON.parse(r.payload) as Record<string, unknown>)
          : (r.payload ?? {}),
      readAt: r.readAt,
      createdAt: r.createdAt,
    }));
  }

  async unreadCount(userId: number): Promise<number> {
    const [row]: { c: number }[] = await this.dataSource.query(
      'SELECT COUNT(*) AS c FROM notifications WHERE userId = ? AND readAt IS NULL',
      [userId],
    );
    return Number(row?.c ?? 0);
  }

  async markRead(userId: number, id: number): Promise<void> {
    await this.dataSource.query(
      'UPDATE notifications SET readAt = NOW(3) WHERE id = ? AND userId = ? AND readAt IS NULL',
      [id, userId],
    );
  }

  async markAllRead(userId: number): Promise<void> {
    await this.dataSource.query(
      'UPDATE notifications SET readAt = NOW(3) WHERE userId = ? AND readAt IS NULL',
      [userId],
    );
  }
}
