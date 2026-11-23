import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { ABSENCE_STREAK_DAYS } from '../dashboard/stats-rules';
import { Person } from '../persons/person.entity';
import {
  GetInspectorAbsenteesQueryDto,
  GetInspectorCasesQueryDto,
  UpdateInspectorCaseDto,
} from './dto/inspector-case.dto';
import {
  CaseOutcome,
  InspectorCase,
  InspectorCaseStatus,
} from './inspector-case.entity';
import { buildCaseReportPdf } from './inspector-case-pdf';
import { loadGuardianContacts, NO_GUARDIANS } from './inspector-guardians';
import { InspectorMahalla } from './inspector-mahalla.entity';
import { InspectorsService } from './inspectors.service';
import { tashkentToday } from './inspector.rules';

const CONTACT_LABELS: Record<string, string> = {
  FATHER: 'Otasi',
  MOTHER: 'Onasi',
  GUARDIAN: 'Vasiy',
  STUDENT: 'O‘quvchining o‘zi',
  NEIGHBOR: 'Qo‘shnilar',
  NOT_MET: 'Hech kim bilan uchrashib bo‘lmadi',
};
const REASON_LABELS: Record<string, string> = {
  ILLNESS: 'Kasallik',
  FAMILY: 'Oilaviy sharoit',
  MIGRATED: 'Boshqa joyga ko‘chib ketgan / chet elda',
  WORKING: 'Ishlayapti',
  NO_INTEREST: 'O‘qishni xohlamayapti',
  NOT_FOUND: 'Manzilda topilmadi',
  OTHER: 'Boshqa sabab',
};
const OUTCOME_LABELS: Record<string, string> = {
  RETURNED: 'Darsga qaytdi',
  EXCUSED: 'Sababli (hujjat bilan tasdiqlandi)',
  REFERRED: 'Boshqa organga yo‘naltirildi',
  TRANSFERRED: 'Boshqa maktabga / hududga o‘tgan',
  STILL_ABSENT: 'Hali ham kelmayapti — nazorat davom etadi',
};

type Row = Record<string, unknown>;

@Injectable()
export class InspectorCasesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inspectors: InspectorsService,
    @InjectRepository(InspectorMahalla)
    private readonly assignments: Repository<InspectorMahalla>,
    @InjectRepository(InspectorCase)
    private readonly cases: Repository<InspectorCase>,
  ) {}

  private async mahallaIds(
    actor: AuthenticatedUser,
    only?: number,
  ): Promise<number[]> {
    const rows = await this.assignments.find({
      where: { userId: actor.id },
      select: { mahallaId: true },
    });
    const ids = rows.map((r) => r.mahallaId);
    if (only !== undefined) {
      if (!ids.includes(only)) {
        throw new ForbiddenException('Bu mahalla sizga biriktirilmagan');
      }
      return [only];
    }
    return ids;
  }

  /** Statistika jadvalidagi eng yangi surat sanasi (bugundan oshmagan). */
  private async snapshotDate(): Promise<string | null> {
    const [row] = await this.q<{ d: string | null }[]>(
      `SELECT DATE_FORMAT(MAX(\`date\`), '%Y-%m-%d') AS d FROM absence_streaks WHERE \`date\` <= ?`,
      [tashkentToday()],
    );
    return row?.d ?? null;
  }

  /** Xom SQL: natija qatorlari. */
  private q<T = Row[]>(sql: string, params: unknown[] = []): Promise<T> {
    return this.dataSource.query<T>(sql, params);
  }

  private placeholders(ids: number[]): string {
    return ids.map(() => '?').join(',');
  }

  // ───────────── Bosh sahifa ─────────────

  async summary(actor: AuthenticatedUser) {
    const ids = await this.mahallaIds(actor);
    const today = tashkentToday();
    if (ids.length === 0) {
      return {
        date: today,
        mahallaCount: 0,
        students: 0,
        today: { PRESENT: 0, EXCUSED: 0, ABSENT: 0, DAY_OFF: 0 },
        absentees: 0,
        newAbsentees: 0,
        openCases: 0,
        closedThisMonth: 0,
        followUpsDue: 0,
        minDays: ABSENCE_STREAK_DAYS,
      };
    }

    const day = await this.inspectors.listStudents(
      { page: 1, limit: 1, date: today },
      actor,
    );
    const snapshot = await this.snapshotDate();
    const marks = this.placeholders(ids);

    const [abs] = snapshot
      ? await this.q(
          `SELECT COUNT(*) AS total,
                  SUM(oc.id IS NULL) AS fresh
             FROM absence_streaks a
             JOIN persons p ON p.id = a.personId AND p.deletedAt IS NULL
             LEFT JOIN inspector_cases oc ON oc.personId = a.personId AND oc.status = 'OPEN'
            WHERE a.\`date\` = ? AND p.mahallaId IN (${marks})`,
          [snapshot, ...ids],
        )
      : [{ total: 0, fresh: 0 }];

    const monthStart = `${today.slice(0, 8)}01`;
    const [mine] = await this.q(
      `SELECT SUM(status = 'OPEN') AS open,
              SUM(status = 'CLOSED' AND DATE(closedAt) >= ?) AS closedMonth,
              SUM(status = 'CLOSED' AND followUpDate IS NOT NULL AND followUpDate <= ?
                  AND NOT EXISTS (SELECT 1 FROM inspector_cases n
                                   WHERE n.personId = k.personId AND n.id > k.id)) AS due
         FROM inspector_cases k WHERE inspectorUserId = ?`,
      [monthStart, today, actor.id],
    );

    const [{ students }] = await this.q<{ students: string }[]>(
      `SELECT COUNT(DISTINCT p.id) AS students
         FROM persons p
         JOIN school_memberships sm ON sm.personId = p.id AND sm.type = 'STUDENT'
          AND sm.startDate <= ? AND (sm.endDate IS NULL OR sm.endDate > ?)
        WHERE p.deletedAt IS NULL AND p.mahallaId IN (${marks})`,
      [today, today, ...ids],
    );

    return {
      date: today,
      mahallaCount: ids.length,
      students: Number(students),
      today: day.counts,
      absentees: Number(abs?.total ?? 0),
      newAbsentees: Number(abs?.fresh ?? 0),
      openCases: Number(mine?.open ?? 0),
      closedThisMonth: Number(mine?.closedMonth ?? 0),
      followUpsDue: Number(mine?.due ?? 0),
      minDays: ABSENCE_STREAK_DAYS,
      snapshotDate: snapshot,
    };
  }

  // ───────────── 5+ kun kelmaganlar ─────────────

  async absentees(
    query: GetInspectorAbsenteesQueryDto,
    actor: AuthenticatedUser,
  ) {
    const ids = await this.mahallaIds(actor, query.mahallaId);
    const date = await this.snapshotDate();
    const empty = {
      date,
      total: 0,
      page: query.page,
      limit: query.limit,
      minDays: ABSENCE_STREAK_DAYS,
      items: [] as unknown[],
    };
    if (ids.length === 0 || !date) return empty;

    const where = [
      `a.\`date\` = ?`,
      `p.mahallaId IN (${this.placeholders(ids)})`,
    ];
    const params: unknown[] = [date, ...ids];
    if (query.state === 'NEW') where.push('oc.id IS NULL');
    if (query.state === 'IN_PROGRESS') where.push('oc.id IS NOT NULL');
    if (query.search) {
      where.push(
        `CONCAT_WS(' ', p.lastName, p.firstName, p.middleName) LIKE ? ESCAPE '!'`,
      );
      params.push(`%${query.search.replace(/[!%_]/g, (c) => `!${c}`)}%`);
    }
    const from = `FROM absence_streaks a
        JOIN persons p ON p.id = a.personId AND p.deletedAt IS NULL
        JOIN mahallas m ON m.id = p.mahallaId
        JOIN schools s ON s.id = a.schoolId
        JOIN school_classes c ON c.id = a.classId
        LEFT JOIN inspector_cases oc ON oc.personId = a.personId AND oc.status = 'OPEN'
       WHERE ${where.join(' AND ')}`;

    const [count] = await this.q(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await this.q(
      `SELECT a.personId, p.firstName, p.lastName, p.middleName, a.days,
              DATE_FORMAT(a.sinceDate, '%Y-%m-%d') AS sinceDate,
              s.id AS schoolId, s.name AS schoolName, c.name AS className,
              m.id AS mahallaId, m.name AS mahallaName, oc.id AS openCaseId,
              (SELECT COUNT(*) FROM inspector_cases k
                WHERE k.personId = a.personId AND k.status = 'CLOSED') AS closedCases
         ${from}
        ORDER BY (oc.id IS NULL) DESC, a.days DESC, p.lastName, p.firstName
        LIMIT ? OFFSET ?`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );

    const guardians = await loadGuardianContacts(
      this.dataSource,
      rows.map((r) => Number(r.personId)),
    );

    return {
      ...empty,
      total: Number(count?.total ?? 0),
      items: rows.map((r) => ({
        guardians: guardians.get(Number(r.personId)) ?? NO_GUARDIANS,
        personId: Number(r.personId),
        firstName: r.firstName,
        lastName: r.lastName,
        middleName: r.middleName,
        days: Number(r.days),
        sinceDate: r.sinceDate,
        school: { id: Number(r.schoolId), name: r.schoolName },
        className: r.className,
        mahalla: { id: Number(r.mahallaId), name: r.mahallaName },
        openCaseId: r.openCaseId === null ? null : Number(r.openCaseId),
        closedCases: Number(r.closedCases),
      })),
    };
  }

  // ───────────── Ishlar ─────────────

  /** Yangi ish ochadi: o‘quvchi uchastkavoy mahallasida va hozir 5+ kun kelmayotgan bo‘lishi shart. */
  async open(personId: number, actor: AuthenticatedUser) {
    const person = await this.dataSource.getRepository(Person).findOne({
      where: { id: personId },
      select: { id: true, mahallaId: true },
    });
    if (!person || person.mahallaId === null) {
      throw new NotFoundException('O‘quvchi topilmadi');
    }
    const assigned = await this.assignments.exists({
      where: { userId: actor.id, mahallaId: person.mahallaId },
    });
    if (!assigned) {
      throw new ForbiddenException('Bu o‘quvchi sizning mahallangizda emas');
    }

    const date = await this.snapshotDate();
    const [streak] = date
      ? await this.q(
          `SELECT schoolId, classId, days, DATE_FORMAT(sinceDate, '%Y-%m-%d') AS sinceDate
             FROM absence_streaks WHERE \`date\` = ? AND personId = ?`,
          [date, personId],
        )
      : [];
    if (!streak) {
      throw new BadRequestException(
        `O‘quvchi ${ABSENCE_STREAK_DAYS} kundan ko‘p ketma-ket kelmaganlar ro‘yxatida emas`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Bir o‘quvchiga ikkita ochiq ish ochilib ketmasligi uchun qatorni qulflaymiz.
      await manager.query('SELECT id FROM persons WHERE id = ? FOR UPDATE', [
        personId,
      ]);
      const existing = await manager.getRepository(InspectorCase).findOne({
        where: { personId, status: InspectorCaseStatus.OPEN },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'Bu o‘quvchi bo‘yicha ochiq ish allaqachon bor',
        );
      }
      const saved = await manager.getRepository(InspectorCase).save(
        manager.getRepository(InspectorCase).create({
          inspectorUserId: actor.id,
          personId,
          schoolId: Number(streak.schoolId),
          classId: streak.classId === null ? null : Number(streak.classId),
          absentSince: String(streak.sinceDate),
          absentDays: Number(streak.days),
          status: InspectorCaseStatus.OPEN,
        }),
      );
      return this.toDto(saved);
    });
  }

  private toDto(c: InspectorCase) {
    return {
      id: c.id,
      personId: c.personId,
      status: c.status,
      absentSince: c.absentSince,
      absentDays: c.absentDays,
      visitDate: c.visitDate,
      spokeWith: c.spokeWith,
      reason: c.reason,
      findings: c.findings,
      actionsTaken: c.actionsTaken,
      outcome: c.outcome,
      followUpDate: c.followUpDate,
      closedAt: c.closedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private async loadOwn(id: number, actor: AuthenticatedUser) {
    const found = await this.cases.findOne({ where: { id } });
    if (!found || found.inspectorUserId !== actor.id) {
      throw new NotFoundException('Ish topilmadi');
    }
    return found;
  }

  private applyFields(c: InspectorCase, dto: UpdateInspectorCaseDto) {
    const today = tashkentToday();
    if (dto.visitDate !== undefined) {
      if (dto.visitDate > today) {
        throw new BadRequestException(
          'Tashrif sanasi kelajakda bo‘lishi mumkin emas',
        );
      }
      if (dto.visitDate < c.absentSince) {
        throw new BadRequestException(
          'Tashrif sanasi kelmay boshlagan kundan oldin bo‘lishi mumkin emas',
        );
      }
      c.visitDate = dto.visitDate;
    }
    if (dto.spokeWith !== undefined) c.spokeWith = dto.spokeWith;
    if (dto.reason !== undefined) c.reason = dto.reason;
    if (dto.findings !== undefined) c.findings = dto.findings || null;
    if (dto.actionsTaken !== undefined)
      c.actionsTaken = dto.actionsTaken || null;
    if (dto.outcome !== undefined) c.outcome = dto.outcome;
    if (dto.followUpDate !== undefined) {
      if (dto.followUpDate <= today) {
        throw new BadRequestException(
          'Keyingi nazorat sanasi kelajakda bo‘lishi kerak',
        );
      }
      c.followUpDate = dto.followUpDate;
    }
  }

  async update(
    id: number,
    dto: UpdateInspectorCaseDto,
    actor: AuthenticatedUser,
  ) {
    const c = await this.loadOwn(id, actor);
    if (c.status !== InspectorCaseStatus.OPEN) {
      throw new ConflictException('Yopilgan ishni o‘zgartirib bo‘lmaydi');
    }
    this.applyFields(c, dto);
    return this.toDto(await this.cases.save(c));
  }

  /** Ishni yopadi: natijalar to‘liq bo‘lishi shart; yopilgach o‘zgartirilmaydi. */
  async close(
    id: number,
    dto: UpdateInspectorCaseDto,
    actor: AuthenticatedUser,
  ) {
    const c = await this.loadOwn(id, actor);
    if (c.status !== InspectorCaseStatus.OPEN) {
      throw new ConflictException('Ish allaqachon yopilgan');
    }
    this.applyFields(c, dto);

    const missing: string[] = [];
    if (!c.visitDate) missing.push('tashrif sanasi');
    if (!c.spokeWith) missing.push('kim bilan suhbat');
    if (!c.reason) missing.push('sabab');
    if (!c.findings || c.findings.trim().length < 10)
      missing.push('aniqlangan holatlar (kamida 10 belgi)');
    if (!c.outcome) missing.push('natija');
    if (missing.length > 0) {
      throw new BadRequestException(
        `Ishni yopish uchun to‘ldiring: ${missing.join(', ')}`,
      );
    }
    if (c.outcome === CaseOutcome.STILL_ABSENT && !c.followUpDate) {
      throw new BadRequestException(
        '“Hali ham kelmayapti” natijasida keyingi nazorat sanasi kerak',
      );
    }

    c.status = InspectorCaseStatus.CLOSED;
    c.closedAt = new Date();
    return this.toDto(await this.cases.save(c));
  }

  async list(query: GetInspectorCasesQueryDto, actor: AuthenticatedUser) {
    const where = ['k.inspectorUserId = ?'];
    const params: unknown[] = [actor.id];
    if (query.status) {
      where.push('k.status = ?');
      params.push(query.status);
    }
    if (query.personId !== undefined) {
      where.push('k.personId = ?');
      params.push(query.personId);
    }
    if (query.search) {
      where.push(
        `CONCAT_WS(' ', p.lastName, p.firstName, p.middleName) LIKE ? ESCAPE '!'`,
      );
      params.push(`%${query.search.replace(/[!%_]/g, (c) => `!${c}`)}%`);
    }
    const from = `FROM inspector_cases k
        JOIN persons p ON p.id = k.personId
        JOIN schools s ON s.id = k.schoolId
        LEFT JOIN school_classes c ON c.id = k.classId
        LEFT JOIN mahallas m ON m.id = p.mahallaId
       WHERE ${where.join(' AND ')}`;
    const [count] = await this.q(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await this.q(
      `SELECT k.id, k.personId, k.status, k.outcome, k.reason, k.absentDays,
              DATE_FORMAT(k.absentSince, '%Y-%m-%d') AS absentSince,
              DATE_FORMAT(k.visitDate, '%Y-%m-%d') AS visitDate,
              DATE_FORMAT(k.followUpDate, '%Y-%m-%d') AS followUpDate,
              k.createdAt, k.closedAt,
              p.firstName, p.lastName, p.middleName,
              s.name AS schoolName, c.name AS className, m.name AS mahallaName
         ${from}
        ORDER BY (k.status = 'OPEN') DESC, k.createdAt DESC, k.id DESC
        LIMIT ? OFFSET ?`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return {
      total: Number(count?.total ?? 0),
      page: query.page,
      limit: query.limit,
      items: rows.map((r) => ({
        id: Number(r.id),
        personId: Number(r.personId),
        status: r.status,
        outcome: r.outcome,
        reason: r.reason,
        absentDays: Number(r.absentDays),
        absentSince: r.absentSince,
        visitDate: r.visitDate,
        followUpDate: r.followUpDate,
        createdAt: r.createdAt,
        closedAt: r.closedAt,
        firstName: r.firstName,
        lastName: r.lastName,
        middleName: r.middleName,
        school: r.schoolName,
        className: r.className,
        mahalla: r.mahallaName,
      })),
    };
  }

  async get(id: number, actor: AuthenticatedUser) {
    const c = await this.loadOwn(id, actor);
    const [person] = await this.q(
      `SELECT p.firstName, p.lastName, p.middleName, p.pnfl, m.name AS mahalla,
              s.name AS school, k.name AS className
         FROM persons p
         LEFT JOIN mahallas m ON m.id = p.mahallaId
         JOIN schools s ON s.id = ?
         LEFT JOIN school_classes k ON k.id = ?
        WHERE p.id = ?`,
      [c.schoolId, c.classId, c.personId],
    );
    // Shu o‘quvchining avvalgi yopilgan ishlari (tarix).
    const history = await this.q(
      `SELECT id, outcome, DATE_FORMAT(absentSince, '%Y-%m-%d') AS absentSince, closedAt
         FROM inspector_cases WHERE personId = ? AND id <> ? AND status = 'CLOSED'
        ORDER BY id DESC LIMIT 20`,
      [c.personId, c.id],
    );
    return {
      ...this.toDto(c),
      student: {
        guardians:
          (await loadGuardianContacts(this.dataSource, [c.personId])).get(
            c.personId,
          ) ?? NO_GUARDIANS,
        firstName: person?.firstName,
        lastName: person?.lastName,
        middleName: person?.middleName,
        mahalla: person?.mahalla ?? null,
        school: person?.school,
        className: person?.className ?? null,
      },
      history: history.map((h) => ({
        id: Number(h.id),
        outcome: h.outcome,
        absentSince: h.absentSince,
        closedAt: h.closedAt,
      })),
    };
  }

  async pdf(id: number, actor: AuthenticatedUser): Promise<Buffer> {
    const c = await this.loadOwn(id, actor);
    const [row] = await this.q(
      `SELECT p.firstName, p.lastName, p.middleName, p.pnfl, m.name AS mahalla,
              s.name AS school, k.name AS className,
              u.firstName AS uFirst, u.lastName AS uLast, u.login AS uLogin
         FROM persons p
         LEFT JOIN mahallas m ON m.id = p.mahallaId
         JOIN schools s ON s.id = ?
         LEFT JOIN school_classes k ON k.id = ?
         JOIN users u ON u.id = ?
        WHERE p.id = ?`,
      [c.schoolId, c.classId, c.inspectorUserId, c.personId],
    );
    if (!row) throw new NotFoundException('O‘quvchi topilmadi');

    const fullName = [row.lastName, row.firstName, row.middleName]
      .filter(Boolean)
      .join(' ');
    const inspectorName =
      [row.uLast, row.uFirst].filter(Boolean).join(' ') || String(row.uLogin);
    return buildCaseReportPdf(
      {
        caseId: c.id,
        status: c.status,
        createdAt: c.createdAt,
        closedAt: c.closedAt,
        student: {
          fullName,
          pnfl: typeof row.pnfl === 'string' && row.pnfl ? row.pnfl : '—',
          school: String(row.school),
          className: (row.className as string | null) ?? null,
          mahalla: (row.mahalla as string | null) ?? null,
        },
        inspectorName,
        absentSince: c.absentSince,
        absentDays: c.absentDays,
        visitDate: c.visitDate,
        spokeWith: c.spokeWith,
        reason: c.reason,
        findings: c.findings,
        actionsTaken: c.actionsTaken,
        outcome: c.outcome,
        followUpDate: c.followUpDate,
      },
      {
        contact: c.spokeWith ? CONTACT_LABELS[c.spokeWith] : '—',
        reason: c.reason ? REASON_LABELS[c.reason] : '—',
        outcome: c.outcome ? OUTCOME_LABELS[c.outcome] : '—',
      },
    );
  }
}
