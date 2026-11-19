import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { LessonSessionStatus } from '../lesson-sessions/lesson-session.entity';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import {
  TeacherContextService,
  sqlDate,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import {
  TextbookTopic,
  TopicReviewStatus,
} from '../textbooks/textbook-topic.entity';
import {
  Textbook,
  TextbookProcessingStatus,
} from '../textbooks/textbook.entity';
import { TextbooksService } from '../textbooks/textbooks.service';
import { UserRole } from '../users/enums/user-role.enum';
import {
  AiGenerationError,
  AiTestGeneratorService,
} from './ai-test-generator.service';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { AssessmentAttemptsService } from './assessment-attempts.service';
import { AssessmentQuestion } from './assessment-question.entity';
import {
  Assessment,
  AssessmentStatus,
  AssessmentType,
} from './assessment.entity';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { PublishAssessmentDto } from './dto/publish-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { extractPages, selectPages } from './pdf-pages';

const STALE_GENERATION_MINUTES = 15;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Noma’lum xato';
}

@Injectable()
export class TeacherAssessmentsService {
  private readonly logger = new Logger(TeacherAssessmentsService.name);
  private readonly dailyLimit: number;
  private readonly maxParallel: number;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TeacherContextService,
    private readonly textbooks: TextbooksService,
    private readonly generator: AiTestGeneratorService,
    private readonly attempts: AssessmentAttemptsService,
    config: ConfigService,
  ) {
    this.dailyLimit = Number(config.get('AI_TESTS_DAILY_LIMIT') ?? 20);
    this.maxParallel = Math.max(
      1,
      Number(config.get('AI_TESTS_CONCURRENCY') ?? 3),
    );
  }

  // ───────────── Mavzular ─────────────

  /** Fan va sinf darajasi bo‘yicha tasdiqlangan darslik mavzulari. */
  private async eligibleTopics(assignment: TeacherClassSubject) {
    const books = await this.dataSource.getRepository(Textbook).find({
      where: {
        subjectId: assignment.subjectId,
        gradeLevel: assignment.schoolClass.gradeLevel!,
        isActive: true,
        isVerified: true,
        processingStatus: TextbookProcessingStatus.READY,
      },
      take: 50,
    });

    if (books.length === 0) return { books, topics: [] as TextbookTopic[] };

    const topics = await this.dataSource.getRepository(TextbookTopic).find({
      where: {
        textbookId: In(books.map((book) => book.id)),
        reviewStatus: TopicReviewStatus.APPROVED,
      },
      order: { textbookId: 'ASC', orderIndex: 'ASC' },
    });

    return { books, topics };
  }

  /** Test uchun mavzular; darsda o‘tilganlari belgilanadi. */
  async availableTopics(user: AuthenticatedUser, assignmentId: number) {
    const assignment = await this.context.ownAssignment(user, assignmentId);
    const { books, topics } = await this.eligibleTopics(assignment);

    const taught: { textbookTopicId: number; lastDate: string | Date }[] =
      topics.length === 0
        ? []
        : await this.dataSource.query(
            `SELECT textbookTopicId, MAX(lessonDate) AS lastDate
               FROM lesson_sessions
              WHERE teacherAssignmentId = ? AND textbookTopicId IS NOT NULL
                AND status <> ?
              GROUP BY textbookTopicId`,
            [assignment.id, LessonSessionStatus.CANCELLED],
          );
    const taughtById = new Map(
      taught.map((row) => [Number(row.textbookTopicId), sqlDate(row.lastDate)]),
    );
    const titles = new Map(books.map((book) => [book.id, book.title]));

    return topics.map((topic) => ({
      id: topic.id,
      textbookId: topic.textbookId,
      textbookTitle: titles.get(topic.textbookId) ?? '',
      orderIndex: topic.orderIndex,
      chapterTitle: topic.chapterTitle,
      title: topic.title,
      pageStart: topic.pageStart,
      pageEnd: topic.pageEnd,
      taughtOn: taughtById.get(topic.id) ?? null,
    }));
  }

  // ───────────── Ro‘yxat va ko‘rish ─────────────

  private async markStale(): Promise<void> {
    await this.dataSource.query(
      `UPDATE assessments
          SET status = ?, generationError = ?
        WHERE status = ? AND updatedAt < NOW(3) - INTERVAL ${STALE_GENERATION_MINUTES} MINUTE`,
      [
        AssessmentStatus.FAILED,
        'Generatsiya to‘xtab qoldi (server qayta ishga tushgan bo‘lishi mumkin)',
        AssessmentStatus.GENERATING,
      ],
    );
  }

  async list(user: AuthenticatedUser, assignmentId?: number) {
    await this.markStale();
    const personId = await this.context.personId(user, UserRole.TEACHER);
    const assignments = await this.context.activeAssignments(personId);
    const ids = assignments
      .map((item) => item.id)
      .filter((id) => assignmentId === undefined || id === assignmentId);

    if (ids.length === 0) return [];

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT a.id, a.teacherAssignmentId, a.type, a.quarter, a.title, a.status,
              a.questionCount, a.durationMinutes, a.startsAt, a.endsAt, a.createdAt,
              (SELECT COUNT(*) FROM assessment_questions q WHERE q.assessmentId = a.id) AS questions,
              (SELECT COUNT(*) FROM assessment_attempts t WHERE t.assessmentId = a.id AND t.submittedAt IS NOT NULL) AS submitted,
              (SELECT AVG(t.percent) FROM assessment_attempts t WHERE t.assessmentId = a.id AND t.submittedAt IS NOT NULL) AS averagePercent
         FROM assessments a
        WHERE a.teacherAssignmentId IN (${ids.map(() => '?').join(',')})
        ORDER BY a.createdAt DESC
        LIMIT 200`,
      ids,
    );

    const byId = new Map(assignments.map((item) => [item.id, item]));

    return rows.map((row) => {
      const assignment = byId.get(Number(row.teacherAssignmentId))!;
      return {
        id: Number(row.id),
        assignmentId: assignment.id,
        class: {
          id: assignment.schoolClass.id,
          name: assignment.schoolClass.name,
        },
        subject: {
          id: assignment.subject.id,
          nameUz: assignment.subject.nameUz,
        },
        type: row.type,
        quarter: row.quarter === null ? null : Number(row.quarter),
        title: row.title,
        status: row.status,
        questionCount: Number(row.questions),
        durationMinutes: Number(row.durationMinutes),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        createdAt: row.createdAt,
        submitted: Number(row.submitted),
        averagePercent:
          row.averagePercent === null
            ? null
            : Math.round(Number(row.averagePercent) * 10) / 10,
      };
    });
  }

  private async own(user: AuthenticatedUser, id: number): Promise<Assessment> {
    const assessment = await this.dataSource
      .getRepository(Assessment)
      .findOneBy({ id });
    if (!assessment) throw new NotFoundException('Test topilmadi');
    // Biriktirma shu o‘qituvchiniki ekanini tekshiradi.
    await this.context.ownAssignment(user, assessment.teacherAssignmentId);
    return assessment;
  }

  private requireStatus(
    assessment: Assessment,
    ...allowed: AssessmentStatus[]
  ) {
    if (!allowed.includes(assessment.status)) {
      throw new ConflictException(
        'Testning hozirgi holatida bu amalni bajarib bo‘lmaydi',
      );
    }
  }

  async detail(user: AuthenticatedUser, id: number) {
    await this.markStale();
    const assessment = await this.own(user, id);
    const assignment = await this.context.ownAssignment(
      user,
      assessment.teacherAssignmentId,
    );
    const questions = await this.dataSource
      .getRepository(AssessmentQuestion)
      .find({
        where: { assessmentId: id },
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
    const topics = await this.dataSource.getRepository(TextbookTopic).find({
      where: { id: In(assessment.topicIds.length ? assessment.topicIds : [0]) },
      order: { textbookId: 'ASC', orderIndex: 'ASC' },
    });

    return {
      ...assessment,
      class: {
        id: assignment.schoolClass.id,
        name: assignment.schoolClass.name,
      },
      subject: { id: assignment.subject.id, nameUz: assignment.subject.nameUz },
      school: { name: assignment.teacherMembership.school.name },
      topics: topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        chapterTitle: topic.chapterTitle,
      })),
      questions: questions.map((question) => ({
        id: question.id,
        orderIndex: question.orderIndex,
        text: question.text,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        topicId: question.topicId,
      })),
    };
  }

  // ───────────── Yaratish va AI generatsiya ─────────────

  async create(user: AuthenticatedUser, dto: CreateAssessmentDto) {
    const assignment = await this.context.ownAssignment(user, dto.assignmentId);
    const { topics } = await this.eligibleTopics(assignment);
    const allowed = new Map(topics.map((topic) => [topic.id, topic]));

    const selected = dto.topicIds.map((id) => allowed.get(id));
    if (selected.some((topic) => !topic)) {
      throw new BadRequestException(
        'Tanlangan mavzular ushbu fan va sinfga mos emas',
      );
    }

    if (
      dto.type === AssessmentType.BSB &&
      new Set(selected.map((topic) => topic!.textbookId)).size > 1
    ) {
      throw new BadRequestException(
        'BSB mavzulari bitta darslikdan bo‘lishi kerak',
      );
    }

    await this.checkLimits(user);

    const title =
      dto.title ||
      (dto.type === AssessmentType.CHSB
        ? `${assignment.subject.nameUz} — ${dto.quarter}-chorak CHSB (${assignment.schoolClass.name})`
        : `${assignment.subject.nameUz} — BSB: ${selected[0]!.chapterTitle ?? selected[0]!.title} (${assignment.schoolClass.name})`
      ).slice(0, 255);

    const assessment = await this.dataSource.getRepository(Assessment).save({
      teacherAssignmentId: assignment.id,
      schoolId: assignment.schoolClass.schoolId,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      type: dto.type,
      quarter: dto.type === AssessmentType.CHSB ? (dto.quarter ?? null) : null,
      title,
      status: AssessmentStatus.GENERATING,
      topicIds: dto.topicIds,
      questionCount: dto.questionCount,
      difficulty: dto.difficulty,
      durationMinutes: dto.durationMinutes,
      createdByUserId: user.id,
    });

    this.startGeneration(assessment.id);
    return { id: assessment.id, status: assessment.status };
  }

  async regenerate(user: AuthenticatedUser, id: number) {
    const assessment = await this.own(user, id);
    this.requireStatus(
      assessment,
      AssessmentStatus.DRAFT,
      AssessmentStatus.FAILED,
    );
    await this.checkLimits(user);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AssessmentQuestion, { assessmentId: id });
      await manager.update(Assessment, id, {
        status: AssessmentStatus.GENERATING,
        generationError: null,
      });
    });

    this.startGeneration(id);
    return { id, status: AssessmentStatus.GENERATING };
  }

  /** AI xarajatini cheklash: kuniga N ta, bir vaqtda bittadan. */
  private async checkLimits(user: AuthenticatedUser): Promise<void> {
    const [row]: { today: string; running: string }[] =
      await this.dataSource.query(
        `SELECT
         SUM(createdAt >= ?) AS today,
         SUM(status = ?) AS running
       FROM assessments WHERE createdByUserId = ?`,
        [
          new Date(`${todayInTashkent()}T00:00:00+05:00`),
          AssessmentStatus.GENERATING,
          user.id,
        ],
      );

    if (Number(row?.running ?? 0) > 0) {
      throw new ConflictException(
        'Oldingi test hali tayyorlanmoqda, biroz kuting',
      );
    }
    if (Number(row?.today ?? 0) >= this.dailyLimit) {
      throw new HttpException(
        `Bir kunda ${this.dailyLimit} tadan ko‘p AI test yaratib bo‘lmaydi`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private startGeneration(id: number): void {
    void this.withSlot(() => this.generate(id)).catch((error: unknown) => {
      this.logger.error(
        `Test ${id} generatsiyasi kutilmagan xato: ${errorText(error)}`,
      );
    });
  }

  /** Bir jarayonda bir vaqtda AI_TESTS_CONCURRENCY ta generatsiya. */
  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxParallel) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  private async generate(id: number): Promise<void> {
    const repository = this.dataSource.getRepository(Assessment);

    try {
      const assessment = await repository.findOneByOrFail({ id });
      const assignment = await this.dataSource
        .getRepository(TeacherClassSubject)
        .findOneOrFail({
          where: { id: assessment.teacherAssignmentId },
          relations: { schoolClass: true, subject: true },
        });
      const topics = await this.dataSource.getRepository(TextbookTopic).find({
        where: { id: In(assessment.topicIds) },
        relations: { textbook: true },
        order: { textbookId: 'ASC', orderIndex: 'ASC' },
      });

      if (topics.length === 0)
        throw new AiGenerationError('Mavzular topilmadi');

      // Eng ko‘p mavzu kelgan darslik asosiy manba bo‘ladi.
      const counts = new Map<number, number>();
      for (const topic of topics)
        counts.set(topic.textbookId, (counts.get(topic.textbookId) ?? 0) + 1);
      const mainBookId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const mainBook = topics.find(
        (topic) => topic.textbookId === mainBookId,
      )!.textbook;

      const pages = selectPages(
        topics
          .filter((topic) => topic.textbookId === mainBookId)
          .map((topic) => ({
            start: topic.pageStart ?? 0,
            end: topic.pageEnd ?? topic.pageStart ?? 0,
          })),
      );

      let pdf: Buffer | null = null;
      if (pages.length > 0) {
        try {
          pdf = await extractPages(
            await this.textbooks.getPdf(mainBookId),
            pages,
          );
        } catch (error: unknown) {
          // PDF o‘qilmasa ham mavzu nomlari bo‘yicha test tuziladi.
          this.logger.warn(
            `Test ${id}: darslik sahifalari olinmadi: ${errorText(error)}`,
          );
        }
      }

      const questions = await this.generator.generate({
        type: assessment.type,
        subject: assignment.subject.nameUz,
        gradeLevel: assignment.schoolClass.gradeLevel ?? mainBook.gradeLevel,
        languageCode: mainBook.languageCode,
        difficulty: assessment.difficulty,
        questionCount: assessment.questionCount,
        topics: topics.map((topic, index) => ({
          index: index + 1,
          title: topic.title,
          chapterTitle: topic.chapterTitle,
        })),
        pdf,
      });

      await this.dataSource.transaction(async (manager) => {
        await manager.delete(AssessmentQuestion, { assessmentId: id });
        await manager.insert(
          AssessmentQuestion,
          questions.map((question, index) => ({
            assessmentId: id,
            orderIndex: index + 1,
            text: question.text,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            topicId: question.topicIndex
              ? topics[question.topicIndex - 1].id
              : null,
          })),
        );
        await manager.update(Assessment, id, {
          status: AssessmentStatus.DRAFT,
          aiModel: this.generator.model,
          generationError: null,
        });
      });

      this.logger.log(`Test ${id}: ${questions.length} ta savol tayyor`);
    } catch (error: unknown) {
      const message =
        error instanceof AiGenerationError
          ? error.message
          : 'Testni tayyorlashda xatolik';
      if (!(error instanceof AiGenerationError)) {
        this.logger.error(
          `Test ${id} generatsiyasi xatosi: ${errorText(error)}`,
        );
      }
      await repository
        .update(id, {
          status: AssessmentStatus.FAILED,
          generationError: message.slice(0, 500),
        })
        .catch(() => undefined);
    }
  }

  // ───────────── Tahrirlash ─────────────

  async update(user: AuthenticatedUser, id: number, dto: UpdateAssessmentDto) {
    const assessment = await this.own(user, id);
    this.requireStatus(assessment, AssessmentStatus.DRAFT);
    await this.dataSource.getRepository(Assessment).update(id, dto);
    return this.detail(user, id);
  }

  async updateQuestion(
    user: AuthenticatedUser,
    id: number,
    questionId: number,
    dto: UpdateQuestionDto,
  ) {
    const assessment = await this.own(user, id);
    this.requireStatus(assessment, AssessmentStatus.DRAFT);

    const options = dto.options.map((option) => option.trim());
    if (options.some((option) => !option) || new Set(options).size !== 4) {
      throw new BadRequestException(
        '4 ta turli, bo‘sh bo‘lmagan variant kiriting',
      );
    }

    const result = await this.dataSource
      .getRepository(AssessmentQuestion)
      .update(
        { id: questionId, assessmentId: id },
        {
          text: dto.text,
          options,
          correctIndex: dto.correctIndex,
          explanation: dto.explanation?.trim() || null,
        },
      );
    if (!result.affected) throw new NotFoundException('Savol topilmadi');

    return { id: questionId };
  }

  async deleteQuestion(
    user: AuthenticatedUser,
    id: number,
    questionId: number,
  ) {
    const assessment = await this.own(user, id);
    this.requireStatus(assessment, AssessmentStatus.DRAFT);

    const result = await this.dataSource
      .getRepository(AssessmentQuestion)
      .delete({ id: questionId, assessmentId: id });
    if (!result.affected) throw new NotFoundException('Savol topilmadi');

    return { id: questionId, deleted: true };
  }

  // ───────────── Nashr va yopish ─────────────

  async publish(
    user: AuthenticatedUser,
    id: number,
    dto: PublishAssessmentDto,
  ) {
    const assessment = await this.own(user, id);
    this.requireStatus(assessment, AssessmentStatus.DRAFT);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = Date.now();

    if (endsAt.getTime() <= startsAt.getTime() + 5 * 60_000) {
      throw new BadRequestException(
        'Tugash vaqti boshlanishdan kamida 5 daqiqa keyin bo‘lsin',
      );
    }
    if (endsAt.getTime() <= now) {
      throw new BadRequestException('Tugash vaqti kelajakda bo‘lishi kerak');
    }
    if (endsAt.getTime() - startsAt.getTime() > 30 * 24 * 60 * 60_000) {
      throw new BadRequestException('Test oynasi 30 kundan oshmasin');
    }

    const questions = await this.dataSource
      .getRepository(AssessmentQuestion)
      .countBy({ assessmentId: id });
    if (questions < 3) {
      throw new BadRequestException(
        'Nashr qilish uchun kamida 3 ta savol kerak',
      );
    }

    await this.dataSource.getRepository(Assessment).update(id, {
      status: AssessmentStatus.PUBLISHED,
      startsAt,
      endsAt,
    });
    return this.detail(user, id);
  }

  async close(user: AuthenticatedUser, id: number) {
    const assessment = await this.own(user, id);
    this.requireStatus(assessment, AssessmentStatus.PUBLISHED);

    const now = new Date();
    await this.dataSource.getRepository(Assessment).update(id, {
      status: AssessmentStatus.CLOSED,
      endsAt:
        assessment.endsAt && assessment.endsAt < now ? assessment.endsAt : now,
    });
    // Ochiq qolgan urinishlar shu vaqtgacha bo‘lgan javoblar bilan yopiladi.
    await this.dataSource.query(
      'UPDATE assessment_attempts SET deadlineAt = LEAST(deadlineAt, ?) WHERE assessmentId = ? AND submittedAt IS NULL',
      [new Date(now.getTime() - 61_000), id],
    );
    await this.attempts.finalizeExpired(id);

    return this.detail(user, id);
  }

  async remove(user: AuthenticatedUser, id: number) {
    const assessment = await this.own(user, id);
    const started = await this.dataSource
      .getRepository(AssessmentAttempt)
      .countBy({ assessmentId: id });

    if (assessment.status === AssessmentStatus.GENERATING || started > 0) {
      throw new ConflictException(
        started > 0
          ? 'O‘quvchilar topshirgan testni o‘chirib bo‘lmaydi — uni yoping'
          : 'Test tayyorlanayotganda o‘chirib bo‘lmaydi',
      );
    }

    await this.dataSource.getRepository(Assessment).delete(id);
    return { id, deleted: true };
  }

  // ───────────── Natijalar ─────────────

  async results(user: AuthenticatedUser, id: number) {
    const assessment = await this.own(user, id);
    await this.attempts.finalizeExpired(id);

    const date = assessment.startsAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
          assessment.startsAt,
        )
      : todayInTashkent();

    const students: {
      personId: number;
      firstName: string;
      lastName: string;
      middleName: string | null;
    }[] = await this.dataSource.query(
      `SELECT DISTINCT p.id AS personId, p.firstName, p.lastName, p.middleName
           FROM school_memberships m
           JOIN persons p ON p.id = m.personId AND p.deletedAt IS NULL
          WHERE m.classId = ? AND m.type = ? AND m.startDate <= ?
            AND (m.endDate IS NULL OR m.endDate > ?)
          ORDER BY p.lastName, p.firstName`,
      [assessment.classId, MembershipType.STUDENT, date, date],
    );

    const attempts = await this.dataSource
      .getRepository(AssessmentAttempt)
      .findBy({ assessmentId: id });
    const attemptByPerson = new Map(
      attempts.map((attempt) => [attempt.personId, attempt]),
    );

    // Sinfdan chiqib ketgan, lekin topshirgan o‘quvchi ham ro‘yxatda qoladi.
    const missing = attempts.filter(
      (attempt) =>
        !students.some(
          (student) => Number(student.personId) === attempt.personId,
        ),
    );
    if (missing.length > 0) {
      const extra: typeof students = await this.dataSource.query(
        `SELECT id AS personId, firstName, lastName, middleName FROM persons WHERE id IN (${missing.map(() => '?').join(',')})`,
        missing.map((attempt) => attempt.personId),
      );
      students.push(...extra);
    }

    const questions = await this.dataSource
      .getRepository(AssessmentQuestion)
      .find({
        where: { assessmentId: id },
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
    const submitted = attempts.filter(
      (attempt) => attempt.submittedAt !== null,
    );

    const rows = students.map((student) => {
      const attempt = attemptByPerson.get(Number(student.personId));
      return {
        personId: Number(student.personId),
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        status: !attempt
          ? 'NOT_STARTED'
          : attempt.submittedAt
            ? 'SUBMITTED'
            : 'IN_PROGRESS',
        startedAt: attempt?.startedAt ?? null,
        submittedAt: attempt?.submittedAt ?? null,
        correctCount: attempt?.correctCount ?? null,
        totalCount: attempt?.totalCount ?? questions.length,
        percent: attempt?.percent ?? null,
        grade: attempt?.grade ?? null,
      };
    });

    const average =
      submitted.length === 0
        ? null
        : Math.round(
            (submitted.reduce(
              (sum, attempt) => sum + (attempt.percent ?? 0),
              0,
            ) /
              submitted.length) *
              10,
          ) / 10;

    const grades = { 5: 0, 4: 0, 3: 0, 2: 0 } as Record<number, number>;
    for (const attempt of submitted) if (attempt.grade) grades[attempt.grade]++;

    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        status: assessment.status,
        startsAt: assessment.startsAt,
        endsAt: assessment.endsAt,
      },
      summary: {
        students: students.length,
        submitted: submitted.length,
        inProgress: attempts.length - submitted.length,
        averagePercent: average,
        grades,
      },
      students: rows,
      questions: questions.map((question) => {
        const answered = submitted.filter(
          (attempt) => attempt.answers?.[String(question.id)] !== undefined,
        );
        const correct = submitted.filter(
          (attempt) =>
            attempt.answers?.[String(question.id)] === question.correctIndex,
        ).length;
        return {
          id: question.id,
          orderIndex: question.orderIndex,
          text: question.text,
          answered: answered.length,
          correctPercent:
            submitted.length === 0
              ? null
              : Math.round((correct / submitted.length) * 1000) / 10,
        };
      }),
    };
  }
}
