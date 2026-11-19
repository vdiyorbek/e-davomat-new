import { parseGenerated, shuffleOptions } from './ai-test-generator.service';
import { percentToGrade, sanitizeAnswers, scoreAnswers } from './grading';
import { selectPages } from './pdf-pages';
import { seededOrder, studentState } from './student-assessments.service';
import { AssessmentStatus } from './assessment.entity';
import { expandLessons } from '../teacher/teacher-cabinet.service';

describe('Baholash', () => {
  it('foizni 5 ballik bahoga o‘tkazadi', () => {
    expect([100, 86, 85.9, 71, 56, 55.9, 0].map(percentToGrade)).toEqual([
      5, 5, 4, 4, 3, 2, 2,
    ]);
  });

  it('faqat to‘g‘ri javoblarni sanaydi', () => {
    const questions = [
      { id: 1, correctIndex: 0 },
      { id: 2, correctIndex: 3 },
      { id: 3, correctIndex: 1 },
    ];
    expect(scoreAnswers(questions, { '1': 0, '2': 1 })).toEqual({
      correct: 1,
      total: 3,
      percent: 33.33,
      grade: 2,
    });
  });

  it('begona savol va noto‘g‘ri variantlarni tashlaydi', () => {
    expect(sanitizeAnswers([1, 2], { '1': 2, '2': 7, '9': 1, x: 0 })).toEqual({
      '1': 2,
    });
    expect(sanitizeAnswers([1], [1, 2])).toEqual({});
  });
});

describe('AI javobini tekshirish', () => {
  const good = (question: string, correctIndex = 1) => ({
    question,
    options: ['A', 'B', 'C', 'D'],
    correctIndex,
    explanation: 'Izoh',
    topicIndex: 1,
  });

  it('yaroqsiz va takroriy savollarni tashlaydi, to‘g‘ri javobni saqlaydi', () => {
    const output = JSON.stringify({
      questions: [
        good('1-savol'),
        good('1-savol'),
        { ...good('2-savol'), options: ['A', 'B', 'C'] },
        { ...good('3-savol'), options: ['A', 'a', 'C', 'D'] },
        { ...good('4-savol'), correctIndex: 4 },
        good('5-savol', 3),
      ],
    });
    const result = parseGenerated(output, 2);

    expect(result.map((q) => q.text)).toEqual(['1-savol', '5-savol']);
    expect(result[0].options[result[0].correctIndex]).toBe('B');
    expect(result[1].options[result[1].correctIndex]).toBe('D');
  });

  it('noto‘g‘ri JSON uchun xato beradi', () => {
    expect(() => parseGenerated('{oops', 1)).toThrow('JSON');
  });

  it('variantlarni aralashtirganda to‘g‘ri javob kuzatiladi', () => {
    const result = shuffleOptions(['to‘g‘ri', 'x', 'y', 'z'], 0, () => 0);
    expect(result.options[result.correctIndex]).toBe('to‘g‘ri');
    expect(result.options).toHaveLength(4);
  });
});

describe('Darslik sahifalari', () => {
  it('mavzular orasida sahifalarni teng taqsimlaydi', () => {
    const pages = selectPages(
      [
        { start: 10, end: 100 },
        { start: 200, end: 203 },
      ],
      10,
    );
    expect(pages).toEqual([10, 11, 12, 13, 14, 200, 201, 202, 203]);
  });

  it('sahifasi noma’lum mavzularni e’tiborsiz qoldiradi', () => {
    expect(selectPages([{ start: 0, end: 0 }])).toEqual([]);
  });
});

describe('O‘quvchi test holati', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  const open = {
    status: AssessmentStatus.PUBLISHED,
    startsAt: new Date('2026-11-18T09:00:00Z'),
    endsAt: new Date('2026-11-18T12:00:00Z'),
  };

  it('vaqt oynasiga qarab holatni aniqlaydi', () => {
    expect(studentState(open, undefined, now)).toBe('OPEN');
    expect(
      studentState(
        { ...open, startsAt: new Date('2026-11-18T11:00:00Z') },
        undefined,
        now,
      ),
    ).toBe('UPCOMING');
    expect(
      studentState(
        { ...open, status: AssessmentStatus.CLOSED },
        undefined,
        now,
      ),
    ).toBe('MISSED');
    expect(
      studentState(
        open,
        { submittedAt: null, deadlineAt: new Date('2026-11-18T10:20:00Z') },
        now,
      ),
    ).toBe('IN_PROGRESS');
    expect(
      studentState(
        open,
        { submittedAt: new Date(), deadlineAt: new Date() },
        now,
      ),
    ).toBe('SUBMITTED');
  });

  it('har o‘quvchiga barqaror, lekin har xil tartib beradi', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededOrder(items, 5)).toEqual(seededOrder(items, 5));
    expect(seededOrder(items, 5)).not.toEqual(seededOrder(items, 6));
    expect([...seededOrder(items, 5)].sort((a, b) => a - b)).toEqual(items);
  });
});

describe('Jadvaldan kunlik darslar', () => {
  it('hafta kuni va amal qilish davriga qarab darslarni yoyadi', () => {
    const schedules = [
      {
        id: 1,
        dayOfWeek: 1,
        startDate: '2026-09-01',
        endDate: null,
        lessonNumber: 2,
      },
      {
        id: 2,
        dayOfWeek: 1,
        startDate: '2026-09-01',
        endDate: '2026-11-17',
        lessonNumber: 1,
      },
      {
        id: 3,
        dayOfWeek: 2,
        startDate: '2026-09-01',
        endDate: null,
        lessonNumber: 1,
      },
    ];
    // 2026-11-16 — dushanba, 2026-11-23 — keyingi dushanba.
    const result = expandLessons(schedules, '2026-11-16', '2026-11-23');
    expect(result.map((r) => `${r.date}#${r.schedule.id}`)).toEqual([
      '2026-11-16#2',
      '2026-11-16#1',
      '2026-11-17#3',
      '2026-11-23#1',
    ]);
  });
});
