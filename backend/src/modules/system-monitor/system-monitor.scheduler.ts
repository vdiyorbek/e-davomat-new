import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/enums/user-role.enum';
import { SystemMonitorService } from './system-monitor.service';
import type { CheckKey, CheckStatus } from './system-monitor.types';

/**
 * Har daqiqada tekshiradi. Holat yomonlashsa (ok → warn/crit yoki warn → crit)
 * Bosh administratorlarga bildirishnoma yuboradi; tuzalganda ham xabar beradi.
 * Bir xil holat soatiga ko‘pi bilan bir marta yuboriladi (dedupeKey).
 */
@Injectable()
export class SystemMonitorScheduler {
  private readonly logger = new Logger(SystemMonitorScheduler.name);
  private readonly previous = new Map<CheckKey, CheckStatus>();
  private running = false;

  constructor(
    private readonly monitor: SystemMonitorService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('45 * * * * *', { timeZone: 'Asia/Tashkent' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const snapshot = await this.monitor.evaluate();
      const hour = snapshot.generatedAt.slice(0, 13);
      const alerts: {
        key: CheckKey;
        type: 'SYSTEM_ALERT' | 'SYSTEM_RECOVERED';
        status: CheckStatus;
      }[] = [];

      for (const check of snapshot.checks) {
        const before = this.previous.get(check.key) ?? 'ok';
        this.previous.set(check.key, check.status);
        if (check.status === before) continue;
        if (check.status === 'ok') {
          alerts.push({
            key: check.key,
            type: 'SYSTEM_RECOVERED',
            status: 'ok',
          });
        } else if (before === 'ok' || check.status === 'crit') {
          alerts.push({
            key: check.key,
            type: 'SYSTEM_ALERT',
            status: check.status,
          });
        }
      }
      if (alerts.length === 0) return;

      const admins: { id: number }[] = await this.dataSource.query(
        `SELECT id FROM users WHERE role = ? AND isActive = 1`,
        [UserRole.SUPER_ADMIN],
      );
      await this.notifications.notify(
        admins.flatMap((admin) =>
          alerts.map((alert) => ({
            userId: Number(admin.id),
            type: alert.type,
            payload: { check: alert.key, status: alert.status },
            dedupeKey: `sys:${alert.key}:${alert.status}:${hour}`,
          })),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Tizim holatini tekshirib bo‘lmadi: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
