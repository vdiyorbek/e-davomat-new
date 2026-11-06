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
}

@Injectable()
export class PersonSyncScheduler {
  private readonly logger = new Logger(PersonSyncScheduler.name);

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
      this.configService.get<string>('PERSON_SYNC_AUTO_CHECK_ENABLED') ===
      'true'
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

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    const hour = Number(get('hour'));

    // 00, 06, 12 yoki 18 soatlik interval.
    const slotHour = String(Math.floor(hour / 6) * 6).padStart(2, '0');

    return `${get('year')}${get('month')}${get('day')}` + `-${slotHour}`;
  }

  @Cron('0 0 */6 * * *', {
    name: 'person-sync-auto-check',
    timeZone: 'Asia/Tashkent',
  })
  async enqueueChecks(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.enqueueing) {
      return;
    }

    this.enqueueing = true;

    try {
      const terminals = await this.terminalsRepository
        .createQueryBuilder('terminal')
        .select(['terminal.id'])
        .where('terminal.isActive = :active', {
          active: true,
        })
        .orderBy('terminal.id', 'ASC')
        .getMany();

      const slot = this.getTashkentSlot();

      let enqueued = 0;
      let failed = 0;

      for (const terminal of terminals) {
        try {
          await this.queue.add(
            PERSON_SYNC_JOB.CHECK_TERMINAL,
            {
              terminalId: terminal.id,
            },
            {
              jobId: `person-check-${terminal.id}-${slot}`,

              // Diagnostika avtomatik takrorlanmaydi.
              attempts: 1,

              removeOnComplete: {
                age: 24 * 60 * 60,
                count: 1000,
              },

              removeOnFail: {
                age: 7 * 24 * 60 * 60,
                count: 1000,
              },
            },
          );

          enqueued++;
        } catch {
          failed++;

          this.logger.warn(
            `Terminal ${terminal.id}: ` +
              'tekshirish vazifasini navbatga ' +
              'joylash muvaffaqiyatsiz',
          );
        }
      }

      this.logger.log(
        `PersonSync: terminal=${terminals.length}, ` +
          `navbatga yuborildi=${enqueued}, ` +
          `xatolik=${failed}, interval=${slot}`,
      );
    } catch {
      this.logger.error(
        'PersonSync scheduler xatosi. ' +
          'MySQL va Redis ulanishlarini tekshiring.',
      );
    } finally {
      this.enqueueing = false;
    }
  }
}
