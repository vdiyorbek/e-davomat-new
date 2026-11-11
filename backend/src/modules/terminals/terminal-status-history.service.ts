import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, MoreThan } from 'typeorm';

import { Terminal } from './terminal.entity';
import { TerminalStatusPeriod } from './terminal-status-period.entity';
import { planStatusChange } from './terminal-status-history.rules';
import type { HealthCheck } from './terminal-status-history.rules';
import { buildDayTimeline } from './terminal-status-timeline.rules';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Toshkent vaqti bo‘yicha bugungi sana (YYYY-MM-DD). */
function todayInTashkent(now: Date): string {
  return new Date(now.getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class TerminalStatusHistoryService {
  private readonly logger = new Logger(TerminalStatusHistoryService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** Bitta health tekshiruvi natijasini holatlar tarixiga yozadi. */
  async recordCheck(
    terminalId: number,
    check: HealthCheck & { error: string | null },
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Bir terminal uchun ikki parallel yozuv bitta ochiq davr
      // o‘rniga ikkitasini yaratmasligi uchun terminal qatorini qulflaymiz.
      await manager.findOne(Terminal, {
        where: { id: terminalId },
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      });

      const periods = manager.getRepository(TerminalStatusPeriod);

      const current = await periods.findOne({
        where: { terminalId, endedAt: IsNull() },
        order: { startedAt: 'DESC' },
      });

      const plan = planStatusChange(current, check);

      if (current && plan.closeAt) {
        await periods.update(current.id, { endedAt: plan.closeAt });
      }

      if (current && plan.extend) {
        await periods.update(current.id, {
          lastCheckAt: check.at,
          checks: () => '`checks` + 1',
          ...(check.ok
            ? {}
            : {
                failedChecks: () => '`failedChecks` + 1',
                lastError: check.error,
              }),
        });
      }

      if (plan.open) {
        await periods.insert({
          terminalId,
          status: plan.open.status,
          startedAt: plan.open.startedAt,
          endedAt: null,
          lastCheckAt: check.at,
          checks: 1,
          failedChecks: check.ok ? 0 : check.failures,
          lastError: check.ok ? null : check.error,
        });

        this.logger.log(
          `Terminal ${terminalId}: ${plan.open.status} ` +
            `(${plan.open.startedAt.toISOString()} dan)`,
        );
      }
    });
  }

  /**
   * Nofaol yoki arxivlangan terminallarning ochiq davrlarini yopadi:
   * ular endi tekshirilmaydi, «Online» abadiy davom etmasligi kerak.
   */
  async closeUnmonitored(now: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE terminal_status_periods p
         JOIN terminals t ON t.id = p.terminalId
          SET p.endedAt = GREATEST(p.lastCheckAt, p.startedAt)
        WHERE p.endedAt IS NULL
          AND (t.isActive = 0 OR t.archivedAt IS NOT NULL)
          AND p.lastCheckAt <= ?`,
      [now],
    );
  }

  /**
   * Bir kunlik holatlar tarixi (Toshkent vaqti bo‘yicha 00:00–24:00).
   * `date` berilmasa — bugun.
   */
  async getDayHistory(terminalId: number, date?: string, now = new Date()) {
    const day = date ?? todayInTashkent(now);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new BadRequestException('Sana formati noto‘g‘ri (YYYY-MM-DD)');
    }

    const dayStart = new Date(`${day}T00:00:00+05:00`);

    if (
      Number.isNaN(dayStart.getTime()) ||
      new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
    ) {
      throw new BadRequestException('Bunday sana mavjud emas');
    }

    if (dayStart.getTime() > now.getTime()) {
      throw new BadRequestException('Kelajakdagi sanani tanlab bo‘lmaydi');
    }

    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    // Kun bilan kesishgan davrlar: kun tugashidan oldin boshlangan va
    // kun boshlangandan keyin tugagan (yoki hali ochiq).
    const periods = await this.dataSource
      .getRepository(TerminalStatusPeriod)
      .find({
        where: [
          {
            terminalId,
            startedAt: LessThan(dayEnd),
            endedAt: MoreThan(dayStart),
          },
          { terminalId, startedAt: LessThan(dayEnd), endedAt: IsNull() },
        ],
        order: { startedAt: 'ASC' },
      });

    const timeline = buildDayTimeline(periods, dayStart, dayEnd, now);

    return {
      terminalId,
      date: day,
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
      isToday: day === todayInTashkent(now),
      generatedAt: now.toISOString(),
      ...timeline,
    };
  }
}
