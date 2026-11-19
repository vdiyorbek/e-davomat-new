import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { assertSchoolAccess } from '../classes/school-access';
import {
  tashkentDate,
  type LiveEvent,
} from '../hikvision-push/hikvision-push.types';
import { School } from '../schools/school.entity';
import { getTerminalHealthStatus } from '../terminals/terminal-health.rules';
import { Terminal } from '../terminals/terminal.entity';
import { LivePeopleService } from './live-people.service';
import { LiveSnapshotService } from './live-snapshot.service';

@Injectable()
export class LiveService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly people: LivePeopleService,
    private readonly snapshots: LiveSnapshotService,
  ) {}

  async assertSchool(
    schoolId: number,
    user: AuthenticatedUser,
  ): Promise<School> {
    const school = await this.dataSource.manager.findOne(School, {
      where: { id: schoolId },
      relations: { district: true },
    });
    if (!school) throw new NotFoundException('Maktab topilmadi');
    assertSchoolAccess(user, school);
    return school;
  }

  async terminals(schoolId: number, user: AuthenticatedUser) {
    await this.assertSchool(schoolId, user);

    const terminals = await this.dataSource.getRepository(Terminal).find({
      where: { schoolId },
      order: { direction: 'ASC', name: 'ASC' },
    });

    return terminals
      .filter((terminal) => !terminal.archivedAt)
      .map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        direction: terminal.direction,
        pushEnabled: terminal.pushEnabled,
        pushLastReceivedAt: terminal.pushLastReceivedAt,
        healthStatus: getTerminalHealthStatus(terminal),
      }));
  }

  /**
   * Bugungi jami ko‘rsatkichlar. Ekrandagi ro‘yxat (oxirgi 100 ta) bilan
   * bog‘liq emas: hisoblagichlar hech qachon «qotib» qolmaydi.
   */
  async summary(schoolId: number, user: AuthenticatedUser) {
    await this.assertSchool(schoolId, user);

    const today = tashkentDate(new Date());
    const startAt = new Date(`${today}T00:00:00+05:00`);

    const [totals]: { passes: string | number; lastEventAt: Date | null }[] =
      await this.dataSource.query(
        `SELECT COUNT(*) AS passes, MAX(eventAt) AS lastEventAt
           FROM attendance_events
          WHERE schoolId = ? AND eventAt >= ?`,
        [schoolId, startAt],
      );

    const arrived: { membershipType: string; total: string | number }[] =
      await this.dataSource.query(
        `SELECT membershipType, COUNT(*) AS total
           FROM daily_attendance
          WHERE schoolId = ? AND date = ? AND firstInTime IS NOT NULL
          GROUP BY membershipType`,
        [schoolId, today],
      );
    const count = (type: string) =>
      Number(arrived.find((row) => row.membershipType === type)?.total ?? 0);

    return {
      date: today,
      passes: Number(totals?.passes ?? 0),
      students: count('STUDENT'),
      teachers: count('TEACHER'),
      lastEventAt: totals?.lastEventAt ?? null,
      serverTime: new Date().toISOString(),
    };
  }

  /** Bugungi oxirgi eventlar — sahifa ochilganda ro‘yxat bo‘sh turmasin. */
  async recent(
    schoolId: number,
    user: AuthenticatedUser,
    limit = 40,
  ): Promise<LiveEvent[]> {
    await this.assertSchool(schoolId, user);

    const today = tashkentDate(new Date());
    const startAt = new Date(`${today}T00:00:00+05:00`);

    const rows: {
      id: string;
      terminalId: number;
      direction: string;
      eventAt: Date;
      pnfl: string;
      photoPath: string | null;
    }[] = await this.dataSource.query(
      `SELECT id, terminalId, direction, eventAt, pnfl, photoPath
         FROM attendance_events
        WHERE schoolId = ? AND eventAt >= ?
        ORDER BY eventAt DESC
        LIMIT ?`,
      [schoolId, startAt, limit],
    );

    const bySchool = await this.people.enrich(
      rows.map((row) => ({
        id: String(row.id),
        schoolId,
        terminalId: Number(row.terminalId),
        direction: row.direction,
        eventAt: row.eventAt,
        date: today,
        pnfl: row.pnfl,
        photoPath: row.photoPath,
      })),
    );
    return bySchool.get(schoolId) ?? [];
  }

  async eventPhoto(eventId: string, user: AuthenticatedUser): Promise<Buffer> {
    if (!/^[1-9]\d{0,19}$/.test(eventId))
      throw new NotFoundException('Rasm topilmadi');

    const [event]: { schoolId: number; photoPath: string | null }[] =
      await this.dataSource.query(
        'SELECT schoolId, photoPath FROM attendance_events WHERE id = ?',
        [eventId],
      );
    if (!event) throw new NotFoundException('Rasm topilmadi');
    await this.assertSchool(Number(event.schoolId), user);
    if (!event.photoPath) throw new NotFoundException('Rasm hali yuklanmagan');

    const root = resolve(process.cwd(), 'uploads', 'attendance');
    const filePath = resolve(process.cwd(), event.photoPath);
    const relativePath = relative(root, filePath);
    if (
      !relativePath ||
      relativePath.startsWith(`..${sep}`) ||
      relativePath === '..'
    ) {
      throw new NotFoundException('Rasm topilmadi');
    }

    try {
      return await readFile(filePath);
    } catch {
      throw new NotFoundException('Rasm fayli topilmadi');
    }
  }

  async snapshot(terminalId: number, user: AuthenticatedUser): Promise<Buffer> {
    const terminal = await this.dataSource
      .getRepository(Terminal)
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal || terminal.archivedAt || !terminal.isActive) {
      throw new NotFoundException('Faol terminal topilmadi');
    }
    await this.assertSchool(terminal.schoolId, user);

    return this.snapshots.snapshot(terminal);
  }
}
