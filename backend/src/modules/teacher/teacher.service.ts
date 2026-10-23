import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { LessonSchedule } from '../lesson-schedules/lesson-schedule.entity';
import {
  LessonSession,
  LessonSessionStatus,
} from '../lesson-sessions/lesson-session.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { SchoolClass } from '../classes/school-class.entity';
import {
  TextbookTopic,
  TopicReviewStatus,
} from '../textbooks/textbook-topic.entity';
import {
  Textbook,
  TextbookProcessingStatus,
} from '../textbooks/textbook.entity';

import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';
import { UpdateTeacherSessionDto } from './dto/update-teacher-session.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { UserPersonLink } from '../user-person-links/user-person-link.entity';

import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';

import { MembershipType } from '../school-memberships/school-membership.entity';

@Injectable()
export class TeacherService {
  constructor(private readonly dataSource: DataSource) {}

  private todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return [get('year'), get('month'), get('day')].join('-');
  }

  private async assertJournalAssignment(
    manager: EntityManager,
    assignmentId: number,
    lessonDate: string,
    actor: AuthenticatedUser,
  ): Promise<TeacherClassSubject> {
    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Faqat o‘qituvchi jurnalga yozishi mumkin');
    }

    const parsed = new Date(`${lessonDate}T00:00:00Z`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(lessonDate) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== lessonDate
    ) {
      throw new BadRequestException('Dars sanasi noto‘g‘ri');
    }

    const link = await manager.findOne(UserPersonLink, {
      where: { userId: actor.id },
      relations: { person: true },
    });

    if (!link || link.person.deletedAt !== null) {
      throw new ForbiddenException('O‘qituvchi akkaunti shaxsga bog‘lanmagan');
    }

    const assignment = await manager.findOne(TeacherClassSubject, {
      where: { id: assignmentId },
      relations: {
        teacherMembership: true,
        schoolClass: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Fan-sinf biriktirmasi topilmadi');
    }

    const membership = assignment.teacherMembership;
    const today = this.todayInTashkent();

    if (
      membership.personId !== link.personId ||
      membership.type !== MembershipType.TEACHER ||
      membership.schoolId !== assignment.schoolClass.schoolId
    ) {
      throw new ForbiddenException('Ushbu fan va sinf sizga tegishli emas');
    }

    // O‘qituvchi hozir ham shu maktabda faol bo‘lishi kerak.
    if (
      membership.startDate > today ||
      (membership.endDate !== null && membership.endDate < today)
    ) {
      throw new ForbiddenException('O‘qituvchining faol maktab a’zoligi yo‘q');
    }

    // Fan biriktirmasi ham hozir faol bo‘lishi kerak.
    if (
      assignment.startDate > today ||
      (assignment.endDate !== null && assignment.endDate <= today)
    ) {
      throw new ForbiddenException('Fan-sinf biriktirmasi faol emas');
    }

    // Tarixiy dars sanasi ham shu biriktirma davrida
    // bo‘lganini tekshiramiz.
    if (
      lessonDate < assignment.startDate ||
      (assignment.endDate !== null && lessonDate >= assignment.endDate) ||
      lessonDate < membership.startDate ||
      (membership.endDate !== null && lessonDate > membership.endDate)
    ) {
      throw new ForbiddenException(
        'Bu sana sizning biriktirma davringizga kirmaydi',
      );
    }

    const years = /^(\d{4})-(\d{4})$/.exec(assignment.schoolClass.academicYear);

    if (
      !years ||
      Number(years[2]) !== Number(years[1]) + 1 ||
      lessonDate < `${years[1]}-09-01` ||
      lessonDate >= `${years[2]}-09-01`
    ) {
      throw new BadRequestException(
        'Dars sanasi sinfning o‘quv yiliga mos emas',
      );
    }

    return assignment;
  }

  async myAssignments(user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Ushbu API faqat o‘qituvchilar uchun');
    }

    const link = await this.dataSource.getRepository(UserPersonLink).findOne({
      where: { userId: user.id },
      relations: { person: true },
    });

    if (!link || link.person.deletedAt !== null) {
      throw new UnauthorizedException('Akkaunt shaxsga bog‘lanmagan');
    }

    const today = this.todayInTashkent();

    const assignments = await this.dataSource
      .getRepository(TeacherClassSubject)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .innerJoinAndSelect('membership.school', 'school')
      .where('membership.personId = :personId', {
        personId: link.personId,
      })
      .andWhere('membership.type = :type', {
        type: MembershipType.TEACHER,
      })
      .andWhere('membership.startDate <= :today', {
        today,
      })
      .andWhere(
        '(membership.endDate IS NULL OR membership.endDate >= :today)',
        { today },
      )
      .andWhere('assignment.startDate <= :today', {
        today,
      })
      .andWhere('(assignment.endDate IS NULL OR assignment.endDate > :today)', {
        today,
      })
      .andWhere('schoolClass.schoolId = membership.schoolId')
      .orderBy('school.name', 'ASC')
      .addOrderBy('schoolClass.name', 'ASC')
      .addOrderBy('subject.nameUz', 'ASC')
      .getMany();

    return assignments.map((assignment) => ({
      id: assignment.id,
      teacherMembershipId: assignment.teacherMembershipId,

      school: {
        id: assignment.teacherMembership.school.id,
        name: assignment.teacherMembership.school.name,
      },

      class: {
        id: assignment.schoolClass.id,
        name: assignment.schoolClass.name,
        academicYear: assignment.schoolClass.academicYear,
        gradeLevel: assignment.schoolClass.gradeLevel,
      },

      subject: {
        id: assignment.subject.id,
        nameUz: assignment.subject.nameUz,
      },

      startDate: assignment.startDate,
      endDate: assignment.endDate,
    }));
  }

  async myJournal(assignmentId: number, date: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Ushbu jurnal faqat o‘qituvchilar uchun');
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    const link = await this.dataSource.getRepository(UserPersonLink).findOne({
      where: { userId: user.id },
      relations: { person: true },
    });

    if (!link || link.person.deletedAt !== null) {
      throw new UnauthorizedException('Akkaunt shaxsga bog‘lanmagan');
    }

    const assignment = await this.dataSource
      .getRepository(TeacherClassSubject)
      .findOne({
        where: { id: assignmentId },
        relations: {
          teacherMembership: true,
          schoolClass: true,
          subject: true,
        },
      });

    if (!assignment) {
      throw new NotFoundException('Fan va sinf biriktirmasi topilmadi');
    }

    const membership = assignment.teacherMembership;

    if (
      membership.personId !== link.personId ||
      membership.type !== MembershipType.TEACHER ||
      membership.schoolId !== assignment.schoolClass.schoolId
    ) {
      throw new ForbiddenException('Ushbu fan va sinf sizga biriktirilmagan');
    }

    const today = this.todayInTashkent();

    // Hozir faol ishlayotgan o‘qituvchigina kabinetdan
    // foydalanadi. Tarixiy darslar esa sanaga qarab olinadi.
    if (
      membership.startDate > today ||
      (membership.endDate !== null && membership.endDate < today)
    ) {
      throw new ForbiddenException('O‘qituvchining faol maktab a’zoligi yo‘q');
    }

    if (
      assignment.startDate > today ||
      (assignment.endDate !== null && assignment.endDate <= today)
    ) {
      throw new ForbiddenException('O‘qituvchining faol fan biriktirmasi yo‘q');
    }

    // Boshqa akademik yilga tegishli sinfdagi darslarni
    // ushbu biriktirma orqali olishni rad etamiz.
    const academicYear = assignment.schoolClass.academicYear;
    const match = /^(\d{4})-(\d{4})$/.exec(academicYear);

    if (!match || date < `${match[1]}-09-01` || date >= `${match[2]}-09-01`) {
      throw new BadRequestException('Sana sinfning o‘quv yiliga mos emas');
    }

    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

    const schedules = await this.dataSource
      .getRepository(LessonSchedule)
      .createQueryBuilder('schedule')
      .where('schedule.teacherAssignmentId = :assignmentId', {
        assignmentId,
      })
      .andWhere('schedule.classId = :classId', {
        classId: assignment.classId,
      })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', {
        dayOfWeek,
      })
      .andWhere('schedule.startDate <= :date', { date })
      .andWhere('(schedule.endDate IS NULL OR schedule.endDate > :date)', {
        date,
      })
      .andWhere('schedule.isActive = :active', {
        active: true,
      })
      .orderBy('schedule.lessonNumber', 'ASC')
      .getMany();

    // Tarixiy sessiyalar jadval versiyasi o‘zgargandan
    // keyin ham o‘z holicha saqlanadi.
    const sessions = await this.dataSource
      .getRepository(LessonSession)
      .createQueryBuilder('session')
      .where('session.teacherAssignmentId = :assignmentId', {
        assignmentId,
      })
      .andWhere('session.classId = :classId', {
        classId: assignment.classId,
      })
      .andWhere('session.lessonDate = :date', { date })
      .orderBy('session.lessonNumber', 'ASC')
      .getMany();

    return {
      assignment: {
        id: assignment.id,
        class: {
          id: assignment.schoolClass.id,
          name: assignment.schoolClass.name,
          academicYear,
        },
        subject: {
          id: assignment.subject.id,
          nameUz: assignment.subject.nameUz,
        },
      },
      date,
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        lessonNumber: schedule.lessonNumber,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        lessonScheduleId: session.lessonScheduleId,
        lessonNumber: session.lessonNumber,
        startTime: session.startTime,
        endTime: session.endTime,
        topicTitle: session.topicTitle,
        homework: session.homework,
        status: session.status,
        textbookTopicId: session.textbookTopicId,
        teacherNotes: session.teacherNotes,
      })),
    };
  }

  async createJournalSession(
    assignmentId: number,
    dto: CreateTeacherSessionDto,
    actor: AuthenticatedUser,
  ) {
    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          const assignment = await this.assertJournalAssignment(
            manager,
            assignmentId,
            dto.lessonDate,
            actor,
          );

          const schedule = await manager.findOne(LessonSchedule, {
            where: { id: dto.lessonScheduleId },
          });

          if (
            !schedule ||
            schedule.teacherAssignmentId !== assignment.id ||
            schedule.classId !== assignment.classId
          ) {
            throw new ForbiddenException(
              'Ushbu dars jadvali sizga tegishli emas',
            );
          }

          const day = new Date(`${dto.lessonDate}T00:00:00Z`).getUTCDay();

          if (
            !schedule.isActive ||
            day === 0 ||
            day !== schedule.dayOfWeek ||
            dto.lessonDate < schedule.startDate ||
            (schedule.endDate !== null && dto.lessonDate >= schedule.endDate)
          ) {
            throw new BadRequestException(
              'Tanlangan sanada ushbu dars mavjud emas',
            );
          }

          const existing = await manager.findOneBy(LessonSession, {
            lessonScheduleId: schedule.id,
            lessonDate: dto.lessonDate,
          });

          if (existing) {
            throw new ConflictException('Ushbu dars uchun jurnal mavjud');
          }

          const session = manager.create(LessonSession, {
            lessonScheduleId: schedule.id,
            lessonDate: dto.lessonDate,
            classId: schedule.classId,
            teacherAssignmentId: assignment.id,
            lessonNumber: schedule.lessonNumber,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            textbookTopicId: null,
            topicTitle: null,
            homework: null,
            teacherNotes: null,
            status: LessonSessionStatus.PLANNED,
          });

          return manager.save(LessonSession, session);
        },
      );
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('Jurnal sessiyasi allaqachon yaratilgan');
      }

      throw error;
    }
  }

  async journalTopics(
    assignmentId: number,
    sessionId: number,
    actor: AuthenticatedUser,
  ) {
    const session = await this.dataSource
      .getRepository(LessonSession)
      .findOneBy({ id: sessionId });

    if (!session || session.teacherAssignmentId !== assignmentId) {
      throw new NotFoundException('Dars topilmadi');
    }

    const assignment = await this.assertJournalAssignment(
      this.dataSource.manager,
      assignmentId,
      session.lessonDate,
      actor,
    );

    const gradeLevel = assignment.schoolClass.gradeLevel;

    if (gradeLevel == null) {
      throw new BadRequestException('Sinf darajasi belgilanmagan');
    }

    const books = await this.dataSource.getRepository(Textbook).find({
      where: {
        subjectId: assignment.subjectId,
        gradeLevel,
        isActive: true,
        isVerified: true,
        processingStatus: TextbookProcessingStatus.READY,
      },
      take: 100,
    });

    if (!books.length) return [];

    const ids = books.map((book) => book.id);
    const booksById = new Map(books.map((book) => [book.id, book]));

    const topics = await this.dataSource
      .getRepository(TextbookTopic)
      .createQueryBuilder('topic')
      .where('topic.textbookId IN (:...ids)', { ids })
      .andWhere('topic.reviewStatus = :status', {
        status: TopicReviewStatus.APPROVED,
      })
      .orderBy('topic.textbookId', 'ASC')
      .addOrderBy('topic.orderIndex', 'ASC')
      .getMany();

    return topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      orderIndex: topic.orderIndex,
      chapterTitle: topic.chapterTitle,
      pageStart: topic.pageStart,
      pageEnd: topic.pageEnd,
      textbook: {
        id: topic.textbookId,
        title: booksById.get(topic.textbookId)?.title ?? '',
      },
    }));
  }

  async updateJournalSession(
    assignmentId: number,
    sessionId: number,
    dto: UpdateTeacherSessionDto,
    actor: AuthenticatedUser,
  ) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('O‘zgartiriladigan ma’lumot yo‘q');
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const session = await manager.findOne(LessonSession, {
        where: { id: sessionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session || session.teacherAssignmentId !== assignmentId) {
        throw new NotFoundException('Dars topilmadi');
      }

      const assignment = await this.assertJournalAssignment(
        manager,
        assignmentId,
        session.lessonDate,
        actor,
      );

      if (assignment.classId !== session.classId) {
        throw new ForbiddenException('Jurnal sinfi biriktirmaga mos emas');
      }

      if (session.status === LessonSessionStatus.CANCELLED) {
        throw new ConflictException(
          'Bekor qilingan darsni tahrirlash mumkin emas',
        );
      }

      if (dto.textbookTopicId !== undefined) {
        if (dto.textbookTopicId === null) {
          session.textbookTopicId = null;
          session.topicTitle = null;
        } else {
          const topic = await manager.findOne(TextbookTopic, {
            where: {
              id: dto.textbookTopicId,
              reviewStatus: TopicReviewStatus.APPROVED,
            },
            relations: { textbook: true },
          });

          if (
            !topic ||
            topic.textbook.subjectId !== assignment.subjectId ||
            topic.textbook.gradeLevel !== assignment.schoolClass.gradeLevel ||
            !topic.textbook.isActive ||
            !topic.textbook.isVerified ||
            topic.textbook.processingStatus !== TextbookProcessingStatus.READY
          ) {
            throw new BadRequestException(
              'Darslik mavzusi ushbu fan va sinfga mos emas',
            );
          }

          session.textbookTopicId = topic.id;
          session.topicTitle = topic.title;
        }
      }

      if (dto.topicTitle !== undefined) {
        if (session.textbookTopicId !== null) {
          throw new BadRequestException(
            'Darslik mavzusi tanlanganda uning nomini alohida o‘zgartirib bo‘lmaydi',
          );
        }

        session.topicTitle = dto.topicTitle?.trim() || null;
      }

      if (dto.homework !== undefined) {
        session.homework = dto.homework?.trim() || null;
      }

      if (dto.teacherNotes !== undefined) {
        session.teacherNotes = dto.teacherNotes?.trim() || null;
      }

      if (dto.status !== undefined) {
        session.status = dto.status;
      }

      return manager.save(LessonSession, session);
    });
  }
}
