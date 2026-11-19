/** Dars holati hozirgi vaqtga nisbatan: o‘tgan, hozir, keyingi, keyinroq. */
export type LessonPhase = 'past' | 'current' | 'next' | 'later';

export function lessonPhases(lessons: { startTime: string; endTime: string }[], now: string): LessonPhase[] {
    let nextMarked = false;
    return lessons.map((lesson) => {
        if (lesson.endTime <= now) return 'past';
        if (lesson.startTime <= now) return 'current';
        if (!nextMarked) {
            nextMarked = true;
            return 'next';
        }
        return 'later';
    });
}
