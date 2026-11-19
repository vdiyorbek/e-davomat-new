import type { AttemptAnswers } from './assessment-attempt.entity';

/**
 * Foizdan 5 ballik bahoga o‘tkazish (summativ baholashda keng
 * qo‘llaniladigan shkala). Maktab boshqacha shkala ishlatsa — shu yerda.
 */
export const GRADE_SCALE = [
  { min: 86, grade: 5 },
  { min: 71, grade: 4 },
  { min: 56, grade: 3 },
  { min: 0, grade: 2 },
] as const;

export function percentToGrade(percent: number): number {
  return GRADE_SCALE.find((step) => percent >= step.min)?.grade ?? 2;
}

export function scoreAnswers(
  questions: { id: number; correctIndex: number }[],
  answers: AttemptAnswers | null,
) {
  const total = questions.length;
  const correct = questions.filter(
    (question) => answers?.[String(question.id)] === question.correctIndex,
  ).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;

  return { correct, total, percent, grade: percentToGrade(percent) };
}

/** Faqat shu testdagi savollar va 0–3 variantlar qabul qilinadi. */
export function sanitizeAnswers(
  questionIds: number[],
  value: unknown,
): AttemptAnswers {
  const allowed = new Set(questionIds.map(String));
  const result: AttemptAnswers = {};

  if (!value || typeof value !== 'object' || Array.isArray(value))
    return result;

  for (const [key, choice] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      allowed.has(key) &&
      Number.isInteger(choice) &&
      (choice as number) >= 0 &&
      (choice as number) <= 3
    ) {
      result[key] = choice as number;
    }
  }

  return result;
}
