import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { DataSource } from 'typeorm';

import {
  fullName,
  safeCell,
  streamExcel,
} from '../../common/export/excel-export';

import { AttendanceExcusesService } from '../attendance-excuses/attendance-excuses.service';
import { CreateAttendanceExcuseDto } from '../attendance-excuses/dto/create-attendance-excuse.dto';
import { AttendanceExcuseStatus } from '../attendance-excuses/attendance-excuse.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { absenceStreak } from '../dashboard/stats-rules';
import { DailyAttendanceReadService } from '../daily-attendance/daily-attendance-read.service';
import { MembershipType } from '../school-memberships/school-membership.entity';
import {
  addDays,
  isIsoDate,
  sqlDate,
  TeacherContextService,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import { UserRole } from '../users/enums/user-role.enum';

export type DayCell =
  'present' | 'absent' | 'excused' | 'dayoff' | 'nodata' | 'future';

export interface OwnClass {
  id: number;
  schoolId: number;
  name: string;
  academicYear: string;
  schoolName: string;
}

interface ClassStudent {
  personId: number;
  pnfl: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  memberSince: string;
}

const MAX_RANGE_DAYS = 62;

/** Joriy o‘quv yili: sentabrdan boshlanadi. */
function academicYearOf(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

@Injectable()
export class HomeroomService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly teacherContext: TeacherContextService,
    private readonly dailyRead: DailyAttendanceReadService,
    private readonly excuses: AttendanceExcusesService,
  ) {}

  // ───────────── Sinflar va ruxsat ─────────────

  private async personId(user: AuthenticatedUser): Promise<number> {
    return this.teacherContext.personId(user, UserRole.TEACHER);
  }

  /** O‘qituvchi sinf rahbari bo‘lgan joriy o‘quv yili sinflari. */
  async classes(user: AuthenticatedUser) {
    const personId = await this.personId(user);
    const today = todayInTashkent();
    const rows: {
      id: number;
      schoolId: number;
      name: string;
      academicYear: string;
      gradeLevel: number | null;
      schoolName: string;
      students: number;
    }[] = await this.dataSource.query(
      `SELECT c.id, c.schoolId, c.name, c.academicYear, c.gradeLevel, s.name AS schoolName,
              (SELECT COUNT(*) FROM school_memberships m
                WHERE m.classId = c.id AND m.type = 'STUDENT'
                  AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?)) AS students
         FROM school_classes c
         JOIN schools s ON s.id = c.schoolId
        WHERE c.homeroomPersonId = ? AND c.academicYear = ?
        ORDER BY c.gradeLevel, c.name`,
      [today, today, personId, academicYearOf(today)],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      schoolId: Number(r.schoolId),
      name: r.name,
      academicYear: r.academicYear,
      gradeLevel: r.gradeLevel === null ? null : Number(r.gradeLevel),
      schoolName: r.schoolName,
      students: Number(r.students),
    }));
  }

  /** Sinf shu o‘qituvchiniki bo‘lishi shart. */
  private async ownClass(
    user: AuthenticatedUser,
    classId: number,
  ): Promise<OwnClass> {
    const personId = await this.personId(user);
    const [row]: OwnClass[] = await this.dataSource.query(
      `SELECT c.id, c.schoolId, c.name, c.academicYear, s.name AS schoolName
         FROM school_classes c JOIN schools s ON s.id = c.schoolId
        WHERE c.id = ? AND c.homeroomPersonId = ?`,
      [classId, personId],
    );
    if (!row) {
      throw new ForbiddenException(
        'Bu sinf sizga sinf rahbari sifatida biriktirilmagan',
      );
    }
    return { ...row, id: Number(row.id), schoolId: Number(row.schoolId) };
  }

  private async students(
    cls: OwnClass,
    from: string,
    to: string,
  ): Promise<ClassStudent[]> {
    const rows: {
      personId: number;
      pnfl: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      memberSince: string | Date;
    }[] = await this.dataSource.query(
      `SELECT p.id AS personId, p.pnfl, p.firstName, p.lastName, p.middleName,
              MIN(m.startDate) AS memberSince
         FROM school_memberships m JOIN persons p ON p.id = m.personId
        WHERE m.classId = ? AND m.type = 'STUDENT' AND p.deletedAt IS NULL
          AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?)
        GROUP BY p.id, p.pnfl, p.firstName, p.lastName, p.middleName
        ORDER BY p.lastName, p.firstName`,
      [cls.id, to, from],
    );
    return rows.map((r) => ({
      personId: Number(r.personId),
      pnfl: r.pnfl,
      firstName: r.firstName,
      lastName: r.lastName,
      middleName: r.middleName,
      memberSince: sqlDate(r.memberSince),
    }));
  }

  // ───────────── Davomat ─────────────

  /** Tanlangan kundagi sinf davomati (adminlar ko‘rgan ro‘yxat bilan bir xil mantiq). */
  async attendance(user: AuthenticatedUser, classId: number, date: string) {
    const cls = await this.ownClass(user, classId);
    if (!isIsoDate(date)) throw new BadRequestException('Sana noto‘g‘ri');

    // Mavjud davomat ro‘yxatini sinf bilan cheklangan maktab admini nomidan o‘qiymiz.
    const scoped: AuthenticatedUser = {
      ...user,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: cls.schoolId,
      districtId: null,
      regionId: null,
    };
    const result = await this.dailyRead.findAll(
      {
        date,
        page: 1,
        limit: 100,
        schoolId: cls.schoolId,
        classId: cls.id,
      },
      scoped,
      MembershipType.STUDENT,
    );
    return { class: cls, ...result };
  }

  /** Kunlar bo‘yicha jadval: har bir o‘quvchi uchun har bir kun holati. */
  async week(
    user: AuthenticatedUser,
    classId: number,
    from: string,
    to: string,
  ) {
    const cls = await this.ownClass(user, classId);
    if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
      throw new BadRequestException('Sana oralig‘i noto‘g‘ri');
    }
    const grid = await this.grid(cls, from, to);
    return {
      class: cls,
      from,
      to,
      days: grid.days,
      students: grid.students.map((s) => ({
        personId: s.personId,
        firstName: s.firstName,
        lastName: s.lastName,
        middleName: s.middleName,
        cells: s.cells,
        present: s.cells.filter((c) => c === 'present').length,
        absent: s.cells.filter((c) => c === 'absent').length,
        excused: s.cells.filter((c) => c === 'excused').length,
      })),
    };
  }

  private async grid(cls: OwnClass, from: string, to: string) {
    const span = Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    );
    if (span + 1 > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Oraliq ${MAX_RANGE_DAYS} kundan oshmasligi kerak`,
      );
    }
    const today = todayInTashkent();
    const students = await this.students(cls, from, to);

    const stateRows: { date: string | Date; state: string; hasData: number }[] =
      await this.dataSource.query(
        `SELECT date, state, hasData FROM class_day_states
          WHERE classId = ? AND date BETWEEN ? AND ?`,
        [cls.id, from, to],
      );
    const presentRows: { pnfl: string; date: string | Date }[] =
      students.length === 0
        ? []
        : await this.dataSource.query(
            `SELECT pnfl, date FROM daily_attendance
              WHERE schoolId = ? AND membershipType = 'STUDENT' AND date BETWEEN ? AND ?
                AND (firstInTime IS NOT NULL OR lastOutTime IS NOT NULL)
                AND pnfl IN (${students.map(() => '?').join(',')})`,
            [cls.schoolId, from, to, ...students.map((s) => s.pnfl)],
          );
    const excuseRows: {
      personId: number;
      startDate: string | Date;
      endDate: string | Date;
    }[] = await this.dataSource.query(
      `SELECT personId, startDate, endDate FROM attendance_excuses
          WHERE schoolId = ? AND membershipType = 'STUDENT' AND status = 'ACTIVE'
            AND startDate <= ? AND endDate >= ?`,
      [cls.schoolId, to, from],
    );

    const states = new Map(
      stateRows.map((r) => [
        sqlDate(r.date),
        { state: r.state, hasData: Number(r.hasData) === 1 },
      ]),
    );
    const present = new Set(
      presentRows.map((r) => `${r.pnfl}:${sqlDate(r.date)}`),
    );
    const excuseMap = new Map<number, { start: string; end: string }[]>();
    for (const e of excuseRows) {
      const list = excuseMap.get(Number(e.personId)) ?? [];
      list.push({ start: sqlDate(e.startDate), end: sqlDate(e.endDate) });
      excuseMap.set(Number(e.personId), list);
    }

    const days: { date: string; state: string; hasData: boolean }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const s = states.get(d);
      days.push({
        date: d,
        state: d > today ? 'FUTURE' : (s?.state ?? 'UNKNOWN'),
        hasData: s?.hasData ?? false,
      });
    }

    const rows = students.map((student) => {
      const cells: DayCell[] = days.map((day) => {
        if (day.date > today) return 'future';
        if (day.date < student.memberSince) return 'nodata';
        if (present.has(`${student.pnfl}:${day.date}`)) return 'present';
        if (day.state === 'DAY_OFF') return 'dayoff';
        if (day.state !== 'WORK_DAY' || !day.hasData) return 'nodata';
        const excused = (excuseMap.get(student.personId) ?? []).some(
          (e) => e.start <= day.date && e.end >= day.date,
        );
        return excused ? 'excused' : 'absent';
      });
      return { ...student, cells };
    });

    return { days, students: rows };
  }

  /** Ketma-ket kelmaganlar (kamida `minDays` o‘quv kuni). Bugun tugamagani uchun kechagacha. */
  async absentees(user: AuthenticatedUser, classId: number, minDays: number) {
    const cls = await this.ownClass(user, classId);
    const today = todayInTashkent();
    const last = addDays(today, -1);
    const from = addDays(last, -29);
    const grid = await this.grid(cls, from, last);

    const result = grid.students
      .map((student) => {
        const reversed = grid.days
          .map((day, index) => ({ day, cell: student.cells[index] }))
          .filter(({ cell }) => cell !== 'dayoff' && cell !== 'nodata')
          .reverse()
          .map(({ day, cell }) => ({
            date: day.date,
            present: cell === 'present',
            excused: cell === 'excused',
          }));
        return { student, streak: absenceStreak(reversed) };
      })
      .filter(({ streak }) => streak.days >= minDays)
      .sort((a, b) => b.streak.days - a.streak.days)
      .map(({ student, streak }) => ({
        personId: student.personId,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        days: streak.days,
        sinceDate: streak.sinceDate,
      }));

    // Ota-ona aloqasi: kelmagan o‘quvchiga darrov qo‘ng‘iroq qilish uchun.
    const guardianRows: {
      personId: number;
      relation: 'FATHER' | 'MOTHER';
      lastName: string | null;
      firstName: string | null;
      phoneNumber: string | null;
    }[] =
      result.length === 0
        ? []
        : await this.dataSource.query(
            `SELECT personId, relation, lastName, firstName, phoneNumber
               FROM person_guardians WHERE personId IN (${result.map(() => '?').join(',')})`,
            result.map((r) => r.personId),
          );

    return {
      class: cls,
      minDays,
      date: last,
      data: result.map((r) => ({
        ...r,
        guardians: guardianRows
          .filter((g) => Number(g.personId) === r.personId)
          .map((g) => ({
            relation: g.relation,
            name: [g.lastName, g.firstName].filter(Boolean).join(' '),
            phoneNumber: g.phoneNumber,
          })),
      })),
    };
  }

  /** Kelmayotgan o‘quvchilar ro‘yxati (ota-ona telefonlari bilan) — .xlsx. */
  async exportAbsentees(
    user: AuthenticatedUser,
    classId: number,
    minDays: number,
    response: Response,
  ): Promise<void> {
    const report = await this.absentees(user, classId, minDays);
    let sent = false;
    const guardian = (
      guardians: {
        relation: string;
        name: string;
        phoneNumber: string | null;
      }[],
      relation: 'FATHER' | 'MOTHER',
    ) => guardians.find((g) => g.relation === relation);

    await streamExcel(response, {
      filename: `kelmayotgan-${String(report.class.name).replace(/[^\w-]+/g, '')}-${report.date}.xlsx`,
      sheetName: 'Kelmaganlar',
      columns: [
        { header: '№', key: 'number', width: 8 },
        { header: 'O‘quvchi F.I.Sh.', key: 'name', width: 42 },
        { header: 'Ketma-ket kun', key: 'days', width: 14 },
        { header: 'Qachondan', key: 'since', width: 14 },
        { header: 'Otasi', key: 'father', width: 32 },
        { header: 'Otasi telefoni', key: 'fatherPhone', width: 18 },
        { header: 'Onasi', key: 'mother', width: 32 },
        { header: 'Onasi telefoni', key: 'motherPhone', width: 18 },
      ],
      // Ro‘yxat bitta so‘rovda olinadi: faqat 1-sahifa to‘la, keyingisi bo‘sh.
      fetchPage: () => {
        if (sent) return Promise.resolve([]);
        sent = true;
        return Promise.resolve(report.data);
      },
      toRow: (row, number) => {
        const father = guardian(row.guardians, 'FATHER');
        const mother = guardian(row.guardians, 'MOTHER');
        return {
          number,
          name: safeCell(fullName(row)),
          days: row.days,
          since: row.sinceDate,
          father: safeCell(father?.name),
          fatherPhone: safeCell(father?.phoneNumber),
          mother: safeCell(mother?.name),
          motherPhone: safeCell(mother?.phoneNumber),
        };
      },
    });
  }

  // ───────────── O‘quvchi kartochkasi ─────────────

  async student(user: AuthenticatedUser, classId: number, personId: number) {
    const cls = await this.ownClass(user, classId);
    const today = todayInTashkent();
    const students = await this.students(cls, today, today);
    const student = students.find((s) => s.personId === personId);
    if (!student) throw new NotFoundException('O‘quvchi bu sinfda topilmadi');

    const from = addDays(today, -29);
    const grid = await this.grid(cls, from, today);
    const mine = grid.students.find((s) => s.personId === personId);
    const cells = mine?.cells ?? [];
    const count = (cell: DayCell) => cells.filter((c) => c === cell).length;
    const present = count('present');
    const absent = count('absent');
    const excused = count('excused');
    const base = present + absent;

    const guardians: {
      relation: 'FATHER' | 'MOTHER';
      lastName: string | null;
      firstName: string | null;
      middleName: string | null;
      phoneNumber: string | null;
    }[] = await this.dataSource.query(
      `SELECT relation, lastName, firstName, middleName, phoneNumber
         FROM person_guardians WHERE personId = ?`,
      [personId],
    );

    return {
      class: cls,
      person: {
        personId,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
      },
      guardians,
      last30: {
        present,
        absent,
        excused,
        rate: base > 0 ? Math.round((present / base) * 1000) / 10 : null,
      },
      days: grid.days.map((day, index) => ({
        date: day.date,
        cell: cells[index] ?? 'nodata',
      })),
    };
  }

  // ───────────── Arizalar ─────────────

  async listExcuses(
    user: AuthenticatedUser,
    classId: number,
    status?: AttendanceExcuseStatus,
  ) {
    const cls = await this.ownClass(user, classId);
    const today = todayInTashkent();
    const students = await this.students(cls, today, today);
    return this.excuses.listForPersons(
      students.map((s) => s.personId),
      cls.schoolId,
      status,
    );
  }

  async submitExcuse(
    user: AuthenticatedUser,
    classId: number,
    dto: Omit<CreateAttendanceExcuseDto, 'schoolId' | 'membershipType'>,
    file: Express.Multer.File | undefined,
  ) {
    const cls = await this.ownClass(user, classId);
    const today = todayInTashkent();
    const students = await this.students(cls, today, today);
    if (!students.some((s) => s.personId === dto.personId)) {
      throw new ForbiddenException('Bu o‘quvchi sizning sinfingizda emas');
    }

    return this.excuses.create(
      {
        ...dto,
        schoolId: cls.schoolId,
        membershipType: MembershipType.STUDENT,
      },
      file,
      user,
      { pending: true },
    );
  }

  /** PDF faqat o‘z sinfi o‘quvchisiga tegishli ariza bo‘lsa beriladi. */
  async excusePdf(user: AuthenticatedUser, excuseId: number): Promise<Buffer> {
    const owner = await this.excuses.findOwnerPerson(excuseId);
    if (!owner) throw new NotFoundException('Ariza topilmadi');

    const personId = await this.personId(user);
    const [row]: { id: number }[] = await this.dataSource.query(
      `SELECT c.id FROM school_classes c
         JOIN school_memberships m ON m.classId = c.id AND m.type = 'STUDENT'
        WHERE c.homeroomPersonId = ? AND m.personId = ? AND c.schoolId = ?
        LIMIT 1`,
      [personId, owner.personId, owner.schoolId],
    );
    if (!row)
      throw new ForbiddenException(
        'Bu ariza sizning sinfingizga tegishli emas',
      );

    return this.excuses.readPdfTrusted(excuseId);
  }
}
