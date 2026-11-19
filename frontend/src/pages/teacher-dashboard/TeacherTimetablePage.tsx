import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LessonTopicDialog } from '@/components/cabinet/LessonTopicDialog';
import { WeekGrid } from '@/components/cabinet/WeekGrid';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useApiQuery } from '@/hooks/useApiQuery';
import { addDays, todayInTashkent, weekStart as mondayOf } from '@/lib/date';
import type { TeacherCabinetLesson } from '@/types/cabinet';

export function TeacherTimetablePage() {
    const { t } = useTranslation();
    const [week, setWeek] = useState(() => mondayOf(todayInTashkent()));
    const [active, setActive] = useState<TeacherCabinetLesson | null>(null);
    const query = useApiQuery<TeacherCabinetLesson[]>(`/teacher/me/schedule?from=${week}&to=${addDays(week, 5)}`);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('teacher.eyebrow')} title={t('cabinet.timetable.title')} description={t('cabinet.timetable.teacherDescription')} />

            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {query.loading ? (
                <LoadingState rows={6} />
            ) : (
                <WeekGrid
                    weekStart={week}
                    onWeekChange={setWeek}
                    lessons={query.data ?? []}
                    dateOf={(lesson) => lesson.date}
                    keyOf={(lesson) => `${lesson.lessonScheduleId}-${lesson.date}`}
                    renderLesson={(lesson) => (
                        <button
                            type="button"
                            onClick={() => setActive(lesson)}
                            className="w-full rounded-xl border bg-background p-2.5 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                                <span>{t('teacher.journal.lesson', { n: lesson.lessonNumber })}</span>
                                <span>
                                    {lesson.startTime}–{lesson.endTime}
                                </span>
                            </span>
                            <span className="mt-1 block font-semibold">
                                {lesson.class.name} · {lesson.subject.nameUz}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {lesson.session?.topicTitle ?? t('teacher.journal.noTopic')}
                            </span>
                        </button>
                    )}
                />
            )}

            {active && (
                <LessonTopicDialog
                    key={`${active.lessonScheduleId}-${active.date}`}
                    lesson={active}
                    open
                    onOpenChange={(open) => {
                        if (!open) setActive(null);
                    }}
                    onChanged={query.retry}
                />
            )}
        </div>
    );
}
