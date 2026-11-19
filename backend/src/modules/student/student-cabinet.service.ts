import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { ClassShiftsService } from '../classes/class-shifts.service';
import { LessonSchedule } from '../lesson-schedules/lesson-schedule.entity';
import { LessonSession } from '../lesson-sessions/lesson-session.entity';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { checkRange, expandLessons } from '../teacher/teacher-cabinet.service';
import {
  addDays,
  sqlDate,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import { StudentContextService } from './student-context.service';

@Injectable()
export class StudentCabinetService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly student: StudentContextService,
    private readonly shifts: ClassShiftsService,
  ) {}

  async overview(user: AuthenticatedUser) {
    const me = await this.student.current(user);
    const today = todayInTashkent();
    const shift =
      (await this.shifts.currentShifts([me.classId], today)).get(me.classId) ??
      null;
    const lessons = await this.lessons(me.classId, today, today);

    const [attendance]: {
      firstInTime: Date | null;
      lastOutTime: Date | null;
    }[] = await this.dataSource.query(
      `SELECT firstInTime, lastOutTime FROM daily_attendance
          WHERE schoolId = ? AND pnfl = ? AND date = ? AND membershipType = ?`,
      [me.schoolId, me.pnfl, today, MembershipType.STUDENT],
    );

    // Oxirgi berilgan uy vazifalari (bugun va oldingi 7 kun).
    const recent = await this.lessons(me.classId, addDays(today, -7), today);
    const homework = recent
      .filter((lesson) => lesson.homework)
      .reverse()
      .slice(0, 10);

    const { pnfl: _pnfl, ...profile } = me;
    void _pnfl;

    return {
      profile,
      shift,
      today,
      lessons,
      homework,
      attendance: attendance
        ? {
            firstInTime: attendance.firstInTime,
            lastOutTime: attendance.lastOutTime,
          }
        : null,
    };
  }

  async schedule(user: AuthenticatedUser, from: unknown, to: unknown) {
    const me = await this.student.current(user);
    const range = checkRange(from, to);
    return this.lessons(me.classId, range.from, range.to);
  }

  /** Davomat tarixi (ko‘pi bilan 62 kun). */
  async attendance(
    user: AuthenticatedUser,
    fromValue: unknown,
    toValue: unknown,
  ) {
    const me = await this.student.current(user);
    const today = todayInTashkent();
    const to =
      typeof toValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toValue)
        ? toValue
        : today;
    let from =
      typeof fromValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromValue)
        ? fromValue
        : addDays(to, -29);
    if (from > to || addDays(from, 61) < to) from = addDays(to, -29);

    const rows: {
      date: string | Date;
      firstInTime: Date | null;
      lastOutTime: Date | null;
    }[] = await this.dataSource.query(
      `SELECT date, firstInTime, lastOutTime FROM daily_attendance
          WHERE schoolId = ? AND pnfl = ? AND membershipType = ? AND date BETWEEN ? AND ?
          ORDER BY date DESC`,
      [me.schoolId, me.pnfl, MembershipType.STUDENT, from, to],
    );

    const excuses: {
      startDate: string | Date;
      endDate: string | Date;
      reason: string;
    }[] = await this.dataSource.query(
      `SELECT startDate, endDate, reason FROM attendance_excuses
          WHERE personId = ? AND status = 'ACTIVE' AND startDate <= ? AND endDate >= ?`,
      [me.personId, to, from],
    );

    const iso = sqlDate;

    return {
      from,
      to,
      days: rows.map((row) => {
        const date = iso(row.date);
        const excused = excuses.some(
          (excuse) =>
            iso(excuse.startDate) <= date && iso(excuse.endDate) >= date,
        );
        return {
          date,
          firstInTime: row.firstInTime,
          lastOutTime: row.lastOutTime,
          status: row.firstInTime ? 'PRESENT' : excused ? 'EXCUSED' : 'ABSENT',
        };
      }),
    };
  }

  private async lessons(classId: number, from: string, to: string) {
    const schedules = await this.dataSource
      .getRepository(LessonSchedule)
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.teacherAssignment', 'assignment')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('membership.person', 'teacher')
      .where('schedule.classId = :classId', { classId })
      .andWhere('schedule.isActive = 1')
      .andWhere('schedule.startDate <= :to', { to })
      .andWhere('(schedule.endDate IS NULL OR schedule.endDate > :from)', {
        from,
      })
      .getMany();

    const sessions = await this.dataSource
      .getRepository(LessonSession)
      .createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.lessonDate BETWEEN :from AND :to', { from, to })
      .getMany();
    const byKey = new Map(
      sessions.map((s) => [`${s.lessonScheduleId}:${s.lessonDate}`, s]),
    );

    return expandLessons(schedules, from, to).map(({ date, schedule }) => {
      const session = byKey.get(`${schedule.id}:${date}`);
      const teacher = schedule.teacherAssignment.teacherMembership.person;
      return {
        date,
        lessonNumber: schedule.lessonNumber,
        startTime: schedule.startTime.slice(0, 5),
        endTime: schedule.endTime.slice(0, 5),
        subject: schedule.teacherAssignment.subject.nameUz,
        teacher: `${teacher.lastName} ${teacher.firstName}`,
        status: session?.status ?? null,
        topicTitle: session?.topicTitle ?? null,
        homework: session?.homework ?? null,
      };
    });
  }
}
