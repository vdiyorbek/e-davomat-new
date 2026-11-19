import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { LessonSchedule } from '../lesson-schedules/lesson-schedule.entity';
import { LessonSession } from '../lesson-sessions/lesson-session.entity';
import { Textbook } from '../textbooks/textbook.entity';
import { TextbooksService } from '../textbooks/textbooks.service';
import { UserRole } from '../users/enums/user-role.enum';
import {
  TeacherContextService,
  addDays,
  isIsoDate,
  todayInTashkent,
} from './teacher-context.service';

const MAX_RANGE_DAYS = 14;

export interface CabinetLesson {
  date: string;
  lessonScheduleId: number;
  assignmentId: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  school: { id: number; name: string };
  class: { id: number; name: string; gradeLevel: number | null };
  subject: { id: number; nameUz: string };
  session: {
    id: number;
    status: string;
    topicTitle: string | null;
    textbookTopicId: number | null;
    homework: string | null;
  } | null;
}

/** Sanalar oralig‘idagi har bir kun uchun jadval bo‘yicha darslar. */
export function expandLessons<
  T extends {
    id: number;
    dayOfWeek: number;
    startDate: string;
    endDate: string | null;
    lessonNumber: number;
  },
>(schedules: T[], from: string, to: string): { date: string; schedule: T }[] {
  const result: { date: string; schedule: T }[] = [];

  for (let date = from; date <= to; date = addDays(date, 1)) {
    // 0 — yakshanba, 1 — dushanba … 6 — shanba (jadval qiymatlari bilan bir xil).
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();

    for (const schedule of schedules) {
      if (
        schedule.dayOfWeek === day &&
        schedule.startDate <= date &&
        (schedule.endDate === null || schedule.endDate > date)
      ) {
        result.push({ date, schedule });
      }
    }
  }

  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.schedule.lessonNumber - b.schedule.lessonNumber,
  );
}

export function checkRange(
  from: unknown,
  to: unknown,
): { from: string; to: string } {
  const start = isIsoDate(from) ? from : todayInTashkent();
  const end = isIsoDate(to) ? to : start;

  if (end < start || addDays(start, MAX_RANGE_DAYS - 1) < end) {
    throw new BadRequestException(
      `Sana oralig‘i 1–${MAX_RANGE_DAYS} kun bo‘lishi kerak`,
    );
  }

  return { from: start, to: end };
}

@Injectable()
export class TeacherCabinetService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TeacherContextService,
    private readonly textbooks: TextbooksService,
  ) {}

  /** O‘qituvchining barcha sinflaridagi darslari (bugungi/haftalik ko‘rinish). */
  async schedule(
    user: AuthenticatedUser,
    fromValue: unknown,
    toValue: unknown,
  ): Promise<CabinetLesson[]> {
    const { from, to } = checkRange(fromValue, toValue);
    const personId = await this.context.personId(user, UserRole.TEACHER);
    const assignments = await this.context.activeAssignments(personId);

    if (assignments.length === 0) return [];

    const byId = new Map(assignments.map((item) => [item.id, item]));
    const ids = [...byId.keys()];

    const schedules = await this.dataSource
      .getRepository(LessonSchedule)
      .createQueryBuilder('schedule')
      .where('schedule.teacherAssignmentId IN (:...ids)', { ids })
      .andWhere('schedule.isActive = 1')
      .andWhere('schedule.startDate <= :to', { to })
      .andWhere('(schedule.endDate IS NULL OR schedule.endDate > :from)', {
        from,
      })
      .getMany();

    const sessions = await this.dataSource
      .getRepository(LessonSession)
      .createQueryBuilder('session')
      .where('session.teacherAssignmentId IN (:...ids)', { ids })
      .andWhere('session.lessonDate BETWEEN :from AND :to', { from, to })
      .getMany();

    const sessionByKey = new Map(
      sessions.map((s) => [`${s.lessonScheduleId}:${s.lessonDate}`, s]),
    );

    return expandLessons(schedules, from, to).map(({ date, schedule }) => {
      const assignment = byId.get(schedule.teacherAssignmentId)!;
      const session = sessionByKey.get(`${schedule.id}:${date}`);

      return {
        date,
        lessonScheduleId: schedule.id,
        assignmentId: assignment.id,
        lessonNumber: schedule.lessonNumber,
        startTime: schedule.startTime.slice(0, 5),
        endTime: schedule.endTime.slice(0, 5),
        school: {
          id: assignment.teacherMembership.school.id,
          name: assignment.teacherMembership.school.name,
        },
        class: {
          id: assignment.schoolClass.id,
          name: assignment.schoolClass.name,
          gradeLevel: assignment.schoolClass.gradeLevel,
        },
        subject: {
          id: assignment.subject.id,
          nameUz: assignment.subject.nameUz,
        },
        session: session
          ? {
              id: session.id,
              status: session.status,
              topicTitle: session.topicTitle,
              textbookTopicId: session.textbookTopicId,
              homework: session.homework,
            }
          : null,
      };
    });
  }

  /** O‘qituvchi faqat o‘zi o‘qitayotgan fan va sinf darajasidagi darslikni ochadi. */
  async textbookPdf(
    user: AuthenticatedUser,
    textbookId: number,
  ): Promise<Buffer> {
    const personId = await this.context.personId(user, UserRole.TEACHER);
    const textbook = await this.dataSource
      .getRepository(Textbook)
      .findOneBy({ id: textbookId, isActive: true });

    if (!textbook) {
      throw new NotFoundException('Darslik topilmadi');
    }

    const assignments = await this.context.activeAssignments(personId);
    const allowed = assignments.some(
      (item) =>
        item.subjectId === textbook.subjectId &&
        item.schoolClass.gradeLevel === textbook.gradeLevel,
    );

    if (!allowed) {
      throw new ForbiddenException(
        'Bu darslik sizning fanlaringizga tegishli emas',
      );
    }

    return this.textbooks.getPdf(textbookId);
  }
}
