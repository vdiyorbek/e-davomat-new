import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WeekGrid } from '@/components/cabinet/WeekGrid';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useApiQuery } from '@/hooks/useApiQuery';
import { addDays, todayInTashkent, weekStart } from '@/lib/date';
import type { StudentLesson } from '@/types/cabinet';

export function StudentSchedulePage() {
    const { t } = useTranslation();
    const [week, setWeek] = useState(() => weekStart(todayInTashkent()));
    const query = useApiQuery<StudentLesson[]>(`/student/me/schedule?from=${week}&to=${addDays(week, 5)}`);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('student.eyebrow')} title={t('cabinet.timetable.title')} description={t('cabinet.timetable.studentDescription')} />
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {query.loading ? (
                <LoadingState rows={6} />
            ) : (
                <WeekGrid
                    weekStart={week}
                    onWeekChange={setWeek}
                    lessons={query.data ?? []}
                    dateOf={(lesson) => lesson.date}
                    keyOf={(lesson) => `${lesson.date}-${lesson.lessonNumber}-${lesson.startTime}`}
                    renderLesson={(lesson) => (
                        <div className="rounded-xl border bg-background p-2.5">
                            <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                                <span>{t('teacher.journal.lesson', { n: lesson.lessonNumber })}</span>
                                <span>
                                    {lesson.startTime}–{lesson.endTime}
                                </span>
                            </p>
                            <p className="mt-1 font-semibold">{lesson.subject}</p>
                            {lesson.topicTitle && <p className="text-xs">{lesson.topicTitle}</p>}
                            {lesson.homework && (
                                <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">
                                    {t('teacher.journal.homework')}: {lesson.homework}
                                </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">{lesson.teacher}</p>
                        </div>
                    )}
                />
            )}
        </div>
    );
}
