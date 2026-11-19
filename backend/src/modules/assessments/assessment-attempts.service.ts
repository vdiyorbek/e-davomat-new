import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, LessThan } from 'typeorm';

import { AssessmentAttempt } from './assessment-attempt.entity';
import { AssessmentQuestion } from './assessment-question.entity';
import { scoreAnswers } from './grading';

/** Topshirish muddatidan keyin tarmoq kechikishi uchun qo‘shimcha vaqt. */
export const SUBMIT_GRACE_MS = 60_000;

@Injectable()
export class AssessmentAttemptsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Urinishni saqlangan javoblar bo‘yicha baholab yopadi. */
  async finalize(
    manager: EntityManager,
    attempt: AssessmentAttempt,
    submittedAt = new Date(),
  ): Promise<AssessmentAttempt> {
    const questions = await manager.find(AssessmentQuestion, {
      select: { id: true, correctIndex: true },
      where: { assessmentId: attempt.assessmentId },
    });
    const score = scoreAnswers(questions, attempt.answers);

    attempt.submittedAt = submittedAt;
    attempt.correctCount = score.correct;
    attempt.totalCount = score.total;
    attempt.percent = score.percent;
    attempt.grade = score.grade;

    return manager.save(AssessmentAttempt, attempt);
  }

  /**
   * Muddati o‘tgan, lekin topshirilmagan urinishlar (o‘quvchi sahifani
   * yopib qo‘ygan) — saqlangan javoblar bilan avtomatik yopiladi.
   */
  async finalizeExpired(
    assessmentId: number,
    personId?: number,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - SUBMIT_GRACE_MS);
    const expired = await this.dataSource
      .getRepository(AssessmentAttempt)
      .find({
        where: {
          assessmentId,
          submittedAt: IsNull(),
          deadlineAt: LessThan(cutoff),
          ...(personId ? { personId } : {}),
        },
      });

    for (const attempt of expired) {
      await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        const locked = await manager.findOne(AssessmentAttempt, {
          where: { id: attempt.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (locked && locked.submittedAt === null) {
          await this.finalize(manager, locked, locked.deadlineAt);
        }
      });
    }
  }
}
