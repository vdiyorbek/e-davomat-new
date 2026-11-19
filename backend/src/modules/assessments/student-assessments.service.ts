import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { StudentContextService } from '../student/student-context.service';
import { AssessmentAttempt } from './assessment-attempt.entity';
import {
  AssessmentAttemptsService,
  SUBMIT_GRACE_MS,
} from './assessment-attempts.service';
import { AssessmentQuestion } from './assessment-question.entity';
import { Assessment, AssessmentStatus } from './assessment.entity';
import { sanitizeAnswers } from './grading';

export type StudentAssessmentState =
  'UPCOMING' | 'OPEN' | 'IN_PROGRESS' | 'SUBMITTED' | 'MISSED';

export function studentState(
  assessment: Pick<Assessment, 'status' | 'startsAt' | 'endsAt'>,
  attempt: Pick<AssessmentAttempt, 'submittedAt' | 'deadlineAt'> | undefined,
  now = Date.now(),
): StudentAssessmentState {
  if (attempt?.submittedAt) return 'SUBMITTED';
  if (attempt && now <= attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS)
    return 'IN_PROGRESS';
  if (
    assessment.status === AssessmentStatus.PUBLISHED &&
    assessment.startsAt &&
    assessment.endsAt
  ) {
    if (now < assessment.startsAt.getTime()) return 'UPCOMING';
    if (now < assessment.endsAt.getTime()) return 'OPEN';
  }
  return 'MISSED';
}

/** Har o‘quvchiga savollar o‘z tartibida — yonidagidan ko‘chirish qiyinlashadi. */
export function seededOrder<T>(items: T[], seed: number): T[] {
  let state = (seed * 2654435761) >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class StudentAssessmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly student: StudentContextService,
    private readonly attempts: AssessmentAttemptsService,
  ) {}

  async list(user: AuthenticatedUser) {
    const me = await this.student.current(user);
    const assessments = await this.dataSource.getRepository(Assessment).find({
      where: {
        classId: me.classId,
        status: In([AssessmentStatus.PUBLISHED, AssessmentStatus.CLOSED]),
      },
      order: { startsAt: 'DESC' },
      take: 100,
    });

    if (assessments.length === 0) return [];

    const ids = assessments.map((item) => item.id);
    for (const id of ids) await this.attempts.finalizeExpired(id, me.personId);

    const attempts = await this.dataSource
      .getRepository(AssessmentAttempt)
      .findBy({
        assessmentId: In(ids),
        personId: me.personId,
      });
    const attemptById = new Map(
      attempts.map((attempt) => [attempt.assessmentId, attempt]),
    );

    const subjects: { id: number; nameUz: string }[] =
      await this.dataSource.query(
        `SELECT id, nameUz FROM curriculum_subjects WHERE id IN (${assessments.map(() => '?').join(',')})`,
        assessments.map((item) => item.subjectId),
      );
    const subjectName = new Map(
      subjects.map((row) => [Number(row.id), row.nameUz]),
    );

    return assessments.map((assessment) => {
      const attempt = attemptById.get(assessment.id);
      return {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        quarter: assessment.quarter,
        subject: subjectName.get(assessment.subjectId) ?? '',
        durationMinutes: assessment.durationMinutes,
        startsAt: assessment.startsAt,
        endsAt: assessment.endsAt,
        state: studentState(assessment, attempt),
        percent: attempt?.percent ?? null,
        grade: attempt?.grade ?? null,
      };
    });
  }

  private async load(user: AuthenticatedUser, id: number) {
    const me = await this.student.current(user);
    const assessment = await this.dataSource
      .getRepository(Assessment)
      .findOneBy({ id });
    const attempt = await this.dataSource
      .getRepository(AssessmentAttempt)
      .findOneBy({ assessmentId: id, personId: me.personId });

    if (
      !assessment ||
      assessment.status === AssessmentStatus.GENERATING ||
      assessment.status === AssessmentStatus.DRAFT ||
      assessment.status === AssessmentStatus.FAILED ||
      (assessment.classId !== me.classId && !attempt)
    ) {
      throw new NotFoundException('Test topilmadi');
    }

    return { me, assessment, attempt };
  }

  private async questionsFor(assessmentId: number, personId: number) {
    const questions = await this.dataSource
      .getRepository(AssessmentQuestion)
      .find({
        where: { assessmentId },
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
    return seededOrder(questions, personId * 31 + assessmentId);
  }

  private session(
    assessment: Assessment,
    attempt: AssessmentAttempt,
    questions: AssessmentQuestion[],
  ) {
    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      durationMinutes: assessment.durationMinutes,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverNow: new Date(),
      answers: attempt.answers ?? {},
      // To‘g‘ri javob va izoh o‘quvchiga yuborilmaydi.
      questions: questions.map((question, index) => ({
        id: question.id,
        number: index + 1,
        text: question.text,
        options: question.options,
      })),
    };
  }

  async start(user: AuthenticatedUser, id: number) {
    const { me, assessment, attempt } = await this.load(user, id);
    const questions = await this.questionsFor(id, me.personId);

    if (attempt) {
      if (
        attempt.submittedAt ||
        Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS
      ) {
        throw new ConflictException('Siz bu testni allaqachon topshirgansiz');
      }
      return this.session(assessment, attempt, questions);
    }

    if (studentState(assessment, undefined) !== 'OPEN') {
      throw new ForbiddenException('Test hozir ochiq emas');
    }

    const now = new Date();
    const deadline = new Date(
      Math.min(
        now.getTime() + assessment.durationMinutes * 60_000,
        assessment.endsAt!.getTime(),
      ),
    );

    try {
      const created = await this.dataSource
        .getRepository(AssessmentAttempt)
        .save({
          assessmentId: id,
          personId: me.personId,
          startedAt: now,
          deadlineAt: deadline,
          submittedAt: null,
          answers: {},
          totalCount: questions.length,
        });
      return this.session(assessment, created, questions);
    } catch (error: unknown) {
      // Ikki oynadan bir vaqtda bosilsa — mavjud urinishni qaytaramiz.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === 'ER_DUP_ENTRY'
      ) {
        const existing = await this.dataSource
          .getRepository(AssessmentAttempt)
          .findOneByOrFail({ assessmentId: id, personId: me.personId });
        return this.session(assessment, existing, questions);
      }
      throw error;
    }
  }

  /** Har javobdan keyin avtomatik saqlash — internet uzilsa ham javoblar yo‘qolmaydi. */
  async saveAnswers(user: AuthenticatedUser, id: number, answers: unknown) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const me = await this.student.current(user);
      const attempt = await manager.findOne(AssessmentAttempt, {
        where: { assessmentId: id, personId: me.personId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) throw new NotFoundException('Test boshlanmagan');
      if (
        attempt.submittedAt ||
        Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS
      ) {
        throw new ConflictException('Test vaqti tugagan yoki topshirilgan');
      }

      const questions = await manager.find(AssessmentQuestion, {
        select: { id: true },
        where: { assessmentId: id },
      });
      attempt.answers = sanitizeAnswers(
        questions.map((question) => question.id),
        answers,
      );
      await manager.save(AssessmentAttempt, attempt);

      return { saved: Object.keys(attempt.answers).length };
    });
  }

  async submit(user: AuthenticatedUser, id: number, answers: unknown) {
    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const me = await this.student.current(user);
      const attempt = await manager.findOne(AssessmentAttempt, {
        where: { assessmentId: id, personId: me.personId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) throw new NotFoundException('Test boshlanmagan');
      if (attempt.submittedAt) return;

      const late = Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS;
      if (!late) {
        const questions = await manager.find(AssessmentQuestion, {
          select: { id: true },
          where: { assessmentId: id },
        });
        attempt.answers = sanitizeAnswers(
          questions.map((question) => question.id),
          answers,
        );
      }
      // Kechikkan bo‘lsa — muddatgacha saqlangan javoblar hisoblanadi.
      await this.attempts.finalize(
        manager,
        attempt,
        late ? attempt.deadlineAt : new Date(),
      );
    });

    return this.result(user, id);
  }

  async result(user: AuthenticatedUser, id: number) {
    const { me, assessment } = await this.load(user, id);
    await this.attempts.finalizeExpired(id, me.personId);

    const attempt = await this.dataSource
      .getRepository(AssessmentAttempt)
      .findOneBy({ assessmentId: id, personId: me.personId });

    if (!attempt?.submittedAt) {
      throw new NotFoundException('Natija hali yo‘q');
    }

    // To‘g‘ri javoblar test oynasi yopilgandan keyin ko‘rsatiladi —
    // aks holda hali topshirmagan sinfdoshlarga tarqalishi mumkin.
    const reveal =
      assessment.status === AssessmentStatus.CLOSED ||
      (assessment.endsAt !== null && assessment.endsAt.getTime() <= Date.now());

    const questions = reveal ? await this.questionsFor(id, me.personId) : [];

    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      submittedAt: attempt.submittedAt,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      percent: attempt.percent,
      grade: attempt.grade,
      revealed: reveal,
      answersAvailableAt: assessment.endsAt,
      questions: questions.map((question, index) => ({
        id: question.id,
        number: index + 1,
        text: question.text,
        options: question.options,
        correctIndex: question.correctIndex,
        chosenIndex: attempt.answers?.[String(question.id)] ?? null,
        explanation: question.explanation,
      })),
    };
  }
}
