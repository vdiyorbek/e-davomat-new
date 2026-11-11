import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerminalStatusHistoryService } from './terminal-status-history.service';
import { HEALTH_CHECK_INTERVAL_MS } from './terminal-health.constants';
import { Terminal } from './terminal.entity';
import { HikvisionService } from './hikvision.service';
import { TerminalCryptoService } from './terminal-crypto.service';

// Bir vaqtning o‘zida nechta terminal tekshiriladi.
const CONCURRENCY = 5;

@Injectable()
export class TerminalHealthScheduler {
  private readonly logger = new Logger(TerminalHealthScheduler.name);

  // Oldingi tekshiruv tugamagan bo‘lsa, yangisini boshlamaslik uchun.
  private running = false;

  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly hikvision: HikvisionService,
    private readonly terminalCrypto: TerminalCryptoService,
    private readonly statusHistory: TerminalStatusHistoryService,
  ) {}

  // Har 2 daqiqada, 30-soniyada ishlaydi (00:00:30, 00:02:30, ...).
  @Cron('30 */2 * * * *', { timeZone: 'Asia/Tashkent' })
  async checkAll(): Promise<void> {
    if (this.running) return;

    this.running = true;
    await this.statusHistory
      .closeUnmonitored(new Date())
      .catch((error: unknown) => {
        this.logger.error(
          `Holatlar tarixini yopib bo‘lmadi: ${this.errorMessage(error)}`,
        );
      });
    try {
      // Parol entity’da select: false, shuning uchun alohida qo‘shamiz.
      const terminals = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .addSelect('terminal.passwordEncrypted')
        .where('terminal.isActive = :active', { active: true })
        .orderBy('terminal.id', 'ASC')
        .getMany();

      // Oddiy navbat: 5 ta "ishchi" ro‘yxatdan navbat bilan terminal oladi.
      const queue = [...terminals];

      const worker = async () => {
        for (let terminal = queue.shift(); terminal; terminal = queue.shift()) {
          await this.checkOne(terminal);
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    } catch (error: unknown) {
      this.logger.error(
        `Terminal holatini tekshirishda xatolik: ${this.errorMessage(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  // Bitta terminalni tekshiradi. Hech qachon xato otmaydi.
  private async checkOne(terminal: Terminal): Promise<void> {
    const now = new Date();

    try {
      const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

      const info = await this.hikvision.getDeviceInfo(terminal, password);

      await this.terminalsRepository.update(terminal.id, {
        lastSeenAt: now,
        lastCheckedAt: now,
        lastError: null,
        consecutiveFailures: 0,
        model: info.model,
        serialNumber: info.serialNumber,
      });

      // Avval xato bo‘lgan bo‘lsa, tiklanganini bir marta yozamiz.
      if (terminal.consecutiveFailures > 0) {
        this.logger.log(
          `Terminal ${terminal.id} (${terminal.name}) qayta online`,
        );
      }
      await this.recordHistory(terminal, now, true, null);
    } catch (error: unknown) {
      const message = this.errorMessage(error).slice(0, 255);

      try {
        await this.terminalsRepository.update(terminal.id, {
          lastCheckedAt: now,
          lastError: message,
          // Hisoblagichni bazaning o‘zida 1 ga oshiramiz.
          consecutiveFailures: () => '`consecutiveFailures` + 1',
        });
      } catch (dbError: unknown) {
        this.logger.error(
          `Terminal ${terminal.id} holatini saqlab bo‘lmadi: ${this.errorMessage(dbError)}`,
        );
      }

      // Faqat birinchi xatoda log yozamiz, har 2 daqiqada emas.
      if (terminal.consecutiveFailures === 0) {
        this.logger.warn(
          `Terminal ${terminal.id} (${terminal.name}) offline: ${message}`,
        );
      }
      await this.recordHistory(terminal, now, false, message);
    }
  }
  /**
   * Holatlar tarixiga yozish. Xato bo‘lsa ham asosiy health
   * tekshiruviga ta’sir qilmaydi — faqat log’ga yoziladi.
   */
  private async recordHistory(
    terminal: Terminal,
    now: Date,
    ok: boolean,
    error: string | null,
  ): Promise<void> {
    // `terminal` — tekshiruvdan OLDINGI holat.
    const failures = ok ? 0 : terminal.consecutiveFailures + 1;

    // Ketma-ket xatolarning birinchisi: shu tekshiruv (1-xato),
    // oldingi tekshiruv (2-xato) yoki taxminan hisoblangan vaqt.
    let firstFailureAt: Date | null = null;

    if (!ok) {
      if (failures === 1) {
        firstFailureAt = now;
      } else if (failures === 2 && terminal.lastCheckedAt) {
        firstFailureAt = new Date(terminal.lastCheckedAt);
      } else {
        firstFailureAt = new Date(
          now.getTime() - (failures - 1) * HEALTH_CHECK_INTERVAL_MS,
        );
      }
    }

    try {
      await this.statusHistory.recordCheck(terminal.id, {
        ok,
        at: now,
        failures,
        firstFailureAt,
        error,
      });
    } catch (historyError: unknown) {
      this.logger.error(
        `Terminal ${terminal.id} holatlar tarixini saqlab bo‘lmadi: ${this.errorMessage(historyError)}`,
      );
    }
  }
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Noma’lum xatolik';
  }
}
