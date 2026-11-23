import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { HikvisionService } from './hikvision.service';
import { TerminalCryptoService } from './terminal-crypto.service';
import { Terminal } from './terminal.entity';
import { TerminalsService } from './terminals.service';

export interface DiagnoseStep {
  key: 'connection' | 'time' | 'audio';
  ok: boolean;
  /** Xato matni (ok = false bo‘lsa) yoki «o‘tkazib yuborildi» sababi. */
  message: string | null;
  data: Record<string, string | number | boolean | null>;
}

export interface TerminalErrorLogItem {
  at: string;
  kind: 'SYNC' | 'OFFLINE';
  /** SYNC uchun — xato kodi; OFFLINE uchun — terminalning oxirgi xato matni. */
  detail: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
}

/**
 * Terminalni qo‘lda tekshirish (faqat o‘qiydi) va xato jurnali.
 * Holat, parol yoki vaqt O‘ZGARTIRILMAYDI.
 */
@Injectable()
export class TerminalDiagnosticsService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly crypto: TerminalCryptoService,
    private readonly hikvision: HikvisionService,
    private readonly terminalsService: TerminalsService,
  ) {}

  async diagnose(id: number) {
    const terminal = await this.terminals
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :id', { id })
      .getOne();
    if (!terminal) throw new NotFoundException('Terminal topilmadi');

    let password: string;
    try {
      password = this.crypto.decrypt(terminal.passwordEncrypted);
    } catch {
      throw new BadRequestException('Terminal parolini ochib bo‘lmadi');
    }

    const started = Date.now();
    const steps: DiagnoseStep[] = [];
    const message = (error: unknown) =>
      (error instanceof Error ? error.message : 'Xato').slice(0, 200);

    // 1) Ulanish. Parol xato bo‘lsa, keyingilarga o‘tilmaydi (bloklanmaslik uchun).
    try {
      const info = await this.hikvision.getDeviceInfo(terminal, password);
      steps.push({
        key: 'connection',
        ok: true,
        message: null,
        data: {
          model: info.model,
          serialNumber: info.serialNumber,
          firmware: info.firmwareVersion || null,
        },
      });
    } catch (error) {
      steps.push({
        key: 'connection',
        ok: false,
        message: message(error),
        data: {},
      });
      return this.result(id, started, steps);
    }

    // 2) Soat farqi (faqat o‘qiydi).
    try {
      const time = await this.hikvision.getDeviceTime(terminal, password);
      steps.push({
        key: 'time',
        ok: true,
        message: null,
        data: {
          differenceSeconds: time.timeDifferenceSeconds,
          status: time.timeStatus,
          roundTripMs: time.networkRoundTripMs,
          timeZone: time.timeZone,
        },
      });
    } catch (error) {
      steps.push({
        key: 'time',
        ok: false,
        message: message(error),
        data: {},
      });
    }

    // 3) Ikki tomonlama audio (faqat o‘qiydi).
    try {
      const audio = await this.hikvision.getTwoWayAudio(terminal, password);
      steps.push({
        key: 'audio',
        ok: true,
        message: null,
        data: { supported: audio.supported, channels: audio.channels },
      });
    } catch (error) {
      steps.push({
        key: 'audio',
        ok: false,
        message: message(error),
        data: {},
      });
    }

    return this.result(id, started, steps);
  }

  private result(id: number, started: number, steps: DiagnoseStep[]) {
    return {
      terminalId: id,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      steps,
    };
  }

  /** Oxirgi 20 ta muammo: sinxronlash xatolari va offline bo‘lgan davrlar. */
  async errorLog(
    id: number,
    user: AuthenticatedUser,
  ): Promise<TerminalErrorLogItem[]> {
    await this.terminalsService.assertTerminalVisible(id, user);

    const runs: { startedAt: Date; errorCode: string | null }[] =
      await this.dataSource.query(
        `SELECT startedAt, errorCode FROM terminal_sync_runs
          WHERE terminalId = ? AND status = 'FAILED'
          ORDER BY startedAt DESC LIMIT 20`,
        [id],
      );
    const periods: {
      startedAt: Date;
      endedAt: Date | null;
      lastError: string | null;
    }[] = await this.dataSource.query(
      `SELECT startedAt, endedAt, lastError FROM terminal_status_periods
        WHERE terminalId = ? AND status = 'OFFLINE'
        ORDER BY startedAt DESC LIMIT 20`,
      [id],
    );

    const items: TerminalErrorLogItem[] = [
      ...runs.map((run) => ({
        at: new Date(run.startedAt).toISOString(),
        kind: 'SYNC' as const,
        detail: run.errorCode,
        endedAt: null,
        durationMinutes: null,
      })),
      ...periods.map((period) => {
        const from = new Date(period.startedAt).getTime();
        const to = period.endedAt ? new Date(period.endedAt).getTime() : null;
        return {
          at: new Date(from).toISOString(),
          kind: 'OFFLINE' as const,
          detail: period.lastError,
          endedAt: to ? new Date(to).toISOString() : null,
          durationMinutes: Math.max(
            0,
            Math.round(((to ?? Date.now()) - from) / 60_000),
          ),
        };
      }),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  }
}
