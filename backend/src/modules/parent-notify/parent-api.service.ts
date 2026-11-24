import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DailyAttendancePersonService } from '../daily-attendance/daily-attendance-person.service';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ParentNotifyService, tashkentParts } from './parent-notify.service';
import { isParentLanguage } from './parent-texts';
import type { ParentLink } from './telegram-init-data.guard';
import { str } from './str';

type Row = Record<string, unknown>;

/** Ichki chaqiruv uchun: ota-onaning farzandga egaligi allaqachon tekshirilgan. */
const INTERNAL_USER = {
  id: 0,
  login: 'parent-app',
  firstName: null,
  lastName: null,
  middleName: null,
  role: UserRole.SUPER_ADMIN,
  regionId: null,
  districtId: null,
  schoolId: null,
  photoUrl: null,
};

function daysInMonth(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

/** Telegram Mini App uchun ota-ona API'si. Faqat o‘z farzandlari va faqat kerakli maydonlar. */
@Injectable()
export class ParentApiService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly parents: ParentNotifyService,
    private readonly attendance: DailyAttendancePersonService,
  ) {}

  async me(link: ParentLink) {
    const children = await this.parents.childrenOf(link.phoneKey);
    return {
      language: link.language,
      today: tashkentParts(new Date()).date,
      preferences: {
        arrival: link.notifyArrival === 1,
        leave: link.notifyLeave === 1,
        absent: link.notifyAbsent === 1,
        excuse: link.notifyExcuse === 1,
      },
      children,
    };
  }

  async updateMe(
    link: ParentLink,
    body: {
      language?: unknown;
      arrival?: unknown;
      leave?: unknown;
      absent?: unknown;
      excuse?: unknown;
    },
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.language !== undefined) {
      if (!isParentLanguage(body.language))
        throw new BadRequestException('Til noto‘g‘ri');
      sets.push('language = ?');
      params.push(body.language);
    }
    const flags: [keyof typeof body, string][] = [
      ['arrival', 'notifyArrival'],
      ['leave', 'notifyLeave'],
      ['absent', 'notifyAbsent'],
      ['excuse', 'notifyExcuse'],
    ];
    for (const [key, column] of flags) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== 'boolean')
        throw new BadRequestException(
          `${String(key)} true/false bo‘lishi kerak`,
        );
      sets.push(`${column} = ?`);
      params.push(body[key] ? 1 : 0);
    }
    if (sets.length > 0) {
      await this.dataSource.query(
        `UPDATE parent_telegram_links SET ${sets.join(', ')} WHERE id = ?`,
        [...params, link.id],
      );
    }
    const [fresh]: ParentLink[] = await this.dataSource.query(
      'SELECT * FROM parent_telegram_links WHERE id = ?',
      [link.id],
    );
    return this.me(fresh ?? link);
  }

  private async ownChild(link: ParentLink, personId: number) {
    const child = (await this.parents.childrenOf(link.phoneKey)).find(
      (item) => item.personId === personId,
    );
    if (!child)
      throw new ForbiddenException('Bu farzand sizga biriktirilmagan');
    return child;
  }

  /** Oylik davomat tarixi (`YYYY-MM`, standart — joriy oy). Rasm havolalari berilmaydi. */
  async monthAttendance(
    link: ParentLink,
    personId: number,
    monthParam?: string,
  ) {
    const child = await this.ownChild(link, personId);
    const today = tashkentParts(new Date()).date;
    const month =
      monthParam && /^20\d{2}-(0[1-9]|1[0-2])$/.test(monthParam)
        ? monthParam
        : today.slice(0, 7);
    if (month > today.slice(0, 7))
      throw new BadRequestException('Kelajak oyi uchun ma’lumot yo‘q');
    const range = daysInMonth(month);
    const to = range.to > today ? today : range.to;

    const [person]: Row[] = await this.dataSource.query(
      'SELECT pnfl FROM persons WHERE id = ?',
      [personId],
    );
    const history = await this.attendance.history(
      {
        pnfl: str(person?.pnfl),
        membershipType: MembershipType.STUDENT,
        from: range.from,
        to,
      },
      INTERNAL_USER,
    );
    return {
      month,
      child,
      stats: history.stats,
      days: history.days.map((day) => ({
        date: day.date,
        status: day.status,
        firstInTime: day.firstInTime
          ? new Date(day.firstInTime).toISOString()
          : null,
        lastOutTime: day.lastOutTime
          ? new Date(day.lastOutTime).toISOString()
          : null,
        excuse: day.excuse ? { reason: day.excuse.reason } : null,
      })),
    };
  }

  /** Arizalar tarixi (oxirgi 50 ta). */
  async excuses(link: ParentLink, personId: number) {
    await this.ownChild(link, personId);
    const rows: Row[] = await this.dataSource.query(
      `SELECT id, status, reason, reasonNote, rejectionReason, createdAt,
              DATE_FORMAT(startDate, '%Y-%m-%d') AS startDate, DATE_FORMAT(endDate, '%Y-%m-%d') AS endDate
         FROM attendance_excuses
        WHERE personId = ? AND membershipType = 'STUDENT'
        ORDER BY id DESC LIMIT 50`,
      [personId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      status: row.status,
      reason: row.reason,
      note: row.reasonNote ?? null,
      rejectionReason: row.rejectionReason ?? null,
      from: row.startDate,
      to: row.endDate,
      createdAt: row.createdAt,
    }));
  }
}
