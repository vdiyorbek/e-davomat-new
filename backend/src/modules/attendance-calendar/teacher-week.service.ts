import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SettingsService } from '../system-settings/settings.service';
import { refreshPrimaryOnly } from './teacher-week';

/** Har kecha: biriktirishlar sanasi o‘tishi va sinf darajalari o‘zgarishini hisobga oladi. */
@Injectable()
export class TeacherWeekService {
  private readonly logger = new Logger(TeacherWeekService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  @Cron('0 30 2 * * *', { timeZone: 'Asia/Tashkent' })
  async nightly(): Promise<void> {
    try {
      await refreshPrimaryOnly(
        this.dataSource,
        this.settings.getInt('calendarPrimaryMaxGrade'),
      );
    } catch (error: unknown) {
      this.logger.error(
        `O‘qituvchi haftasini yangilab bo‘lmadi: ${error instanceof Error ? error.message : 'xato'}`,
      );
    }
  }
}
