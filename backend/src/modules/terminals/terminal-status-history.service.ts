import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

import { Terminal } from './terminal.entity';
import { TerminalStatusPeriod } from './terminal-status-period.entity';
import { planStatusChange } from './terminal-status-history.rules';
import type { HealthCheck } from './terminal-status-history.rules';

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
}
