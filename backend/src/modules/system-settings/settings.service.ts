import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  findSetting,
  parseSettingValue,
  serializeSettingValue,
  SETTINGS,
  type SettingValue,
} from './settings.registry';

/** Boshqa jarayonlar (push server, worker) o‘zgarishni shuncha vaqtda ko‘radi. */
const REFRESH_MS = 15_000;

interface Row {
  key: string;
  value: string;
  updatedAt: Date;
  login: string | null;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Tizim sozlamalari: bazadagi qiymat → .env/kod standarti. O‘qish sinxron va
 * xotiradan (har 15 soniyada bazadan yangilanadi), shuning uchun issiq yo‘llarda
 * (rasm yuklash, push qabul qilish) so‘rov qo‘shilmaydi.
 */
@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, SettingValue>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    try {
      const rows: { key: string; value: string }[] =
        await this.dataSource.query(
          'SELECT `key`, `value` FROM system_settings',
        );
      const next = new Map<string, SettingValue>();
      for (const row of rows) {
        const definition = findSetting(row.key);
        const value = definition
          ? parseSettingValue(definition, row.value)
          : null;
        if (value !== null) next.set(row.key, value);
      }
      this.cache = next;
    } catch (error: unknown) {
      // Baza vaqtincha ko‘rinmasa — oxirgi ma’lum qiymatlar saqlanadi.
      this.logger.warn(
        `Sozlamalarni yangilab bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    }
  }

  private value(key: string): SettingValue {
    const definition = findSetting(key);
    if (!definition) throw new Error(`Noma’lum sozlama: ${key}`);
    return this.cache.get(key) ?? definition.getDefault();
  }

  getInt(key: string): number {
    return Number(this.value(key));
  }

  getBool(key: string): boolean {
    return this.value(key) === true;
  }

  async list() {
    const rows: Row[] = await this.dataSource.query(
      `SELECT s.\`key\`, s.\`value\`, s.updatedAt, u.login, u.firstName, u.lastName
         FROM system_settings s LEFT JOIN users u ON u.id = s.updatedByUserId`,
    );
    const stored = new Map(rows.map((row) => [row.key, row]));

    return SETTINGS.map((definition) => {
      const row = stored.get(definition.key);
      const override = row ? parseSettingValue(definition, row.value) : null;
      return {
        key: definition.key,
        group: definition.group,
        type: definition.type,
        min: definition.min ?? null,
        max: definition.max ?? null,
        unit: definition.unit ?? null,
        default: definition.getDefault(),
        value: override ?? definition.getDefault(),
        overridden: override !== null,
        updatedAt: override !== null && row ? row.updatedAt : null,
        updatedBy:
          override !== null && row?.login
            ? {
                login: row.login,
                name:
                  [row.lastName, row.firstName].filter(Boolean).join(' ') ||
                  null,
              }
            : null,
      };
    });
  }

  async set(key: string, raw: unknown, userId: number) {
    const definition = findSetting(key);
    if (!definition) throw new NotFoundException('Sozlama topilmadi');

    const value = parseSettingValue(definition, raw);
    if (value === null) {
      const range =
        definition.type === 'int'
          ? ` (${definition.min ?? '…'} – ${definition.max ?? '…'} oralig‘ida butun son)`
          : ' (ha/yo‘q)';
      throw new BadRequestException(`Qiymat noto‘g‘ri${range}`);
    }

    const serialized = serializeSettingValue(value);
    await this.dataSource.transaction(async (manager) => {
      const [previous]: { value: string }[] = await manager.query(
        'SELECT `value` FROM system_settings WHERE `key` = ? FOR UPDATE',
        [key],
      );
      if (previous?.value === serialized) return;
      await manager.query(
        `INSERT INTO system_settings (\`key\`, \`value\`, updatedByUserId)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`),
           updatedByUserId = VALUES(updatedByUserId)`,
        [key, serialized, userId],
      );
      await manager.query(
        `INSERT INTO system_settings_history (\`key\`, oldValue, newValue, changedByUserId)
         VALUES (?, ?, ?, ?)`,
        [key, previous?.value ?? null, serialized, userId],
      );
    });

    this.cache.set(key, value);
    return this.item(key);
  }

  /** Standartga qaytarish: bazadagi qiymat o‘chiriladi. */
  async reset(key: string, userId: number) {
    if (!findSetting(key)) throw new NotFoundException('Sozlama topilmadi');

    await this.dataSource.transaction(async (manager) => {
      const [previous]: { value: string }[] = await manager.query(
        'SELECT `value` FROM system_settings WHERE `key` = ? FOR UPDATE',
        [key],
      );
      if (!previous) return;
      await manager.query('DELETE FROM system_settings WHERE `key` = ?', [key]);
      await manager.query(
        `INSERT INTO system_settings_history (\`key\`, oldValue, newValue, changedByUserId)
         VALUES (?, ?, NULL, ?)`,
        [key, previous.value, userId],
      );
    });

    this.cache.delete(key);
    return this.item(key);
  }

  private async item(key: string) {
    return (await this.list()).find((entry) => entry.key === key);
  }

  async history(limit = 50) {
    const take = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
    const rows: {
      id: string;
      key: string;
      oldValue: string | null;
      newValue: string | null;
      changedAt: Date;
      login: string | null;
      firstName: string | null;
      lastName: string | null;
    }[] = await this.dataSource.query(
      `SELECT h.id, h.\`key\`, h.oldValue, h.newValue, h.changedAt,
              u.login, u.firstName, u.lastName
         FROM system_settings_history h LEFT JOIN users u ON u.id = h.changedByUserId
        ORDER BY h.id DESC LIMIT ?`,
      [take],
    );
    return rows.map((row) => ({
      id: String(row.id),
      key: row.key,
      oldValue: row.oldValue,
      newValue: row.newValue,
      changedAt: row.changedAt,
      changedBy: row.login
        ? {
            login: row.login,
            name:
              [row.lastName, row.firstName].filter(Boolean).join(' ') || null,
          }
        : null,
    }));
  }
}
