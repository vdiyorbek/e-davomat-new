import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';

import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';

import {
  PERSON_SYNC_JOB,
  PERSON_SYNC_QUEUE,
} from '../terminals/person-sync.constants';

interface PersonSyncCheckJob {
  terminalId: number;
  personId?: number;
}

@Injectable()
export class PersonSyncScheduler {
  private readonly logger = new Logger(PersonSyncScheduler.name);

  private readonly pageSize = 100;
  private enqueueing = false;

  constructor(
    @InjectQueue(PERSON_SYNC_QUEUE)
    private readonly queue: Queue<PersonSyncCheckJob>,

    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly configService: ConfigService,
  ) {}

  private isEnabled(): boolean {
    return (
      this.configService.get<string>(
        'PERSON_SYNC_AUTO_CHECK_ENABLED',
        'false',
      ) === 'true'
    );
  }

  private getTashkentSlot(): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());

    const get = (type: string): string =>
      parts.find((part) => part.type === type)?.value ?? '';

    const hour = Number(get('hour'));
    const slotHour = String(Math.floor(hour / 6) * 6).padStart(2, '0');

    return `${get('year')}${get('month')}${get('day')}` + `-${slotHour}`;
  }

  @Cron('0 0 */6 * * *', {
    name: 'person-sync-auto-check',
    timeZone: 'Asia/Tashkent',
  })
  async enqueueChecks(force = false) {
    if (!force && !this.isEnabled()) {
      return {
        status: 'DISABLED',
        message: 'Avtomatik tekshiruv o‘chirilgan',
      };
    }

    if (this.enqueueing) {
      return {
        status: 'ALREADY_RUNNING',
        message: 'Scheduler allaqachon ishlamoqda',
      };
    }

    this.enqueueing = true;

    const startedAt = Date.now();
    const slot = this.getTashkentSlot();

    let lastTerminalId = 0;
    let totalTerminals = 0;
    let enqueued = 0;
    let failed = 0;

    try {
      this.logger.log(`PersonSync scheduler START: slot=${slot}`);

      while (true) {
        // Terminallarni ID bo‘yicha sahifalab olamiz.
        // Barcha jadvalni xotiraga yuklamaymiz.
        const terminals = await this.terminalsRepository
          .createQueryBuilder('terminal')
          .select(['terminal.id'])
          .where('terminal.isActive = :active', {
            active: true,
          })
          .andWhere('terminal.id > :lastTerminalId', {
            lastTerminalId,
          })
          .orderBy('terminal.id', 'ASC')
          .take(this.pageSize)
          .getMany();

        if (terminals.length === 0) {
          break;
        }

        for (const terminal of terminals) {
          totalTerminals++;

          try {
            const jobId = `person-check-${terminal.id}-${slot}`;

            await this.queue.add(
              PERSON_SYNC_JOB.CHECK_TERMINAL,
              {
                terminalId: terminal.id,
              },
              {
                jobId,

                // Bir job uchun avtomatik qayta
                // urinish yo‘q.
                attempts: 1,

                // Tekshiruv natijalarini vaqtincha
                // Redis'da saqlaymiz.
                removeOnComplete: {
                  age: 24 * 60 * 60,
                  count: 5000,
                },

                removeOnFail: {
                  age: 7 * 24 * 60 * 60,
                  count: 5000,
                },
              },
            );

            enqueued++;
          } catch (error: unknown) {
            failed++;

            this.logger.warn(
              `Terminal ${terminal.id}: ` +
                'navbatga joylashda xatolik. ' +
                (error instanceof Error ? error.message : 'Unknown error'),
            );
          }

          lastTerminalId = terminal.id;
        }

        if (terminals.length < this.pageSize) {
          break;
        }
      }

      this.logger.log(
        `PersonSync scheduler FINISHED: ` +
          `slot=${slot}, ` +
          `terminals=${totalTerminals}, ` +
          `enqueueCalls=${enqueued}, ` +
          `failed=${failed}, ` +
          `durationMs=${Date.now() - startedAt}`,
      );
      return {
        status: failed === 0 ? 'QUEUED' : 'PARTIAL',
        slot,
        totalTerminals,
        enqueueCalls: enqueued,
        failed,
        durationMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      this.logger.error(
        'PersonSync scheduler umumiy xatosi: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
      throw error;
    } finally {
      this.enqueueing = false;
    }
  }

  async previewChecks() {
    const activeTerminals = await this.terminalsRepository.count({
      where: { isActive: true },
    });

    return {
      activeTerminals,
      autoCheckEnabled: this.isEnabled(),
      mode: 'PREVIEW',
      willWriteToTerminal: false,
    };
  }
}
