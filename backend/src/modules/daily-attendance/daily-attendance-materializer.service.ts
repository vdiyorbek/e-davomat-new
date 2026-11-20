import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { tashkentDate } from '../hikvision-push/hikvision-push.types';
import { DailyAttendanceService } from './daily-attendance.service';

/** So‘rov paytida darhol (sinxron) tayyorlanadigan maktablar soni; qolganlari fonda. */
const SYNC_LIMIT = 5;
const CONCURRENCY = 3;
const CRON_BATCH = 300;

interface Scope {
  regionId?: number;
  districtId?: number;
  schoolId?: number;
}

/**
 * Davomat qatorlari (daily_attendance) faqat maktabda o‘sha kuni birinchi event kelganda
 * yaratilar edi. Event kelmagan kunda (terminal o‘chiq, navbat yetmagan) ro‘yxat bo‘sh qolardi.
 * Endi har maktab a’zolari uchun qatorlar:
 *  • bugun — har 30 daqiqada hamma maktablar uchun;
 *  • o‘tgan kun — ro‘yxat so‘ralganda, agar maktabda shu kungacha kamida bitta kelish
 *    bo‘lgan bo‘lsa (ya’ni platforma o‘sha maktabda ishga tushgan bo‘lsa).
 * Qatorda event bo‘lmasa, ro‘yxatda «Kelmagan» yoki «Ma’lumot yo‘q» bo‘lib chiqadi.
 */
@Injectable()
export class DailyAttendanceMaterializer {
  private readonly logger = new Logger(DailyAttendanceMaterializer.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly daily: DailyAttendanceService,
  ) {}

  /** Qatorlari yo‘q, lekin a’zolari bor (va platforma ishga tushgan) maktablar. */
  private async missingSchools(
    date: string,
    scopeSql: string,
    scopeParams: unknown[],
    limit: number,
  ): Promise<number[]> {
    const today = tashkentDate(new Date());
    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT s.id
         FROM schools s
         JOIN districts d ON d.id = s.districtId
        WHERE ${scopeSql}
          AND NOT EXISTS (SELECT 1 FROM daily_attendance x WHERE x.schoolId = s.id AND x.date = ?)
          AND EXISTS (
            SELECT 1 FROM school_memberships m
             WHERE m.schoolId = s.id AND m.type IN ('STUDENT', 'TEACHER')
               AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?)
          )
          AND (? = ? OR EXISTS (
            SELECT 1 FROM daily_attendance f
             WHERE f.schoolId = s.id AND f.firstInTime IS NOT NULL AND f.date <= ?
          ))
        ORDER BY s.id
        LIMIT ?`,
      [...scopeParams, date, date, date, date, today, date, limit],
    );
    return rows.map((row) => Number(row.id));
  }

  private async rebuildAll(date: string, schoolIds: number[]): Promise<void> {
    let cursor = 0;
    const worker = async () => {
      while (cursor < schoolIds.length) {
        const schoolId = schoolIds[cursor++];
        try {
          await this.daily.rebuild({ schoolId, date });
        } catch (error: unknown) {
          this.logger.warn(
            `Maktab ${schoolId}, ${date}: qatorlarni tayyorlab bo‘lmadi — ${error instanceof Error ? error.message : 'xato'}`,
          );
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  /** Ro‘yxat so‘ralganda: ko‘rinadigan maktablar uchun shu sana qatorlarini ta’minlaydi. */
  async ensureForRequest(
    date: string,
    user: AuthenticatedUser,
    scope: Scope,
  ): Promise<void> {
    if (date > tashkentDate(new Date())) return;

    const where: string[] = [];
    const params: unknown[] = [];
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;
      case UserRole.REGION_ADMIN:
        where.push('d.regionId = ?');
        params.push(user.regionId ?? 0);
        break;
      case UserRole.DISTRICT_ADMIN:
        where.push('s.districtId = ?');
        params.push(user.districtId ?? 0);
        break;
      case UserRole.SCHOOL_ADMIN:
        where.push('s.id = ?');
        params.push(user.schoolId ?? 0);
        break;
      default:
        return;
    }
    if (scope.regionId) {
      where.push('d.regionId = ?');
      params.push(scope.regionId);
    }
    if (scope.districtId) {
      where.push('s.districtId = ?');
      params.push(scope.districtId);
    }
    if (scope.schoolId) {
      where.push('s.id = ?');
      params.push(scope.schoolId);
    }

    const ids = await this.missingSchools(
      date,
      where.length ? where.join(' AND ') : '1 = 1',
      params,
      200,
    );
    if (ids.length === 0) return;

    // Birinchilari — so‘rov tugashidan oldin (ro‘yxat darhol to‘liq chiqsin), qolganlari fonda.
    await this.rebuildAll(date, ids.slice(0, SYNC_LIMIT));
    const rest = ids.slice(SYNC_LIMIT);
    if (rest.length > 0) void this.rebuildAll(date, rest);
  }

  /** Bugun: hamma maktablar a’zolari uchun qatorlar (har 30 daqiqada, faqat yo‘qlari). */
  @Cron('0 7,37 * * * *', { timeZone: 'Asia/Tashkent' })
  async materializeToday(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const today = tashkentDate(new Date());
      for (;;) {
        const ids = await this.missingSchools(today, '1 = 1', [], CRON_BATCH);
        if (ids.length === 0) break;
        await this.rebuildAll(today, ids);
        if (ids.length < CRON_BATCH) break;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Bugungi qatorlarni tayyorlab bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
