import { useState } from 'react';
import { CalendarDays, Clock, NotebookPen } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateLong, nowTimeInTashkent, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { TeacherCabinetLesson } from '@/types/cabinet';
import { lessonPhases } from '@/lib/lessons';
import { LessonTopicDialog } from './LessonTopicDialog';

/** O‘qituvchining bugungi darslari: hozirgi dars ajralib turadi, bir bosishda mavzu tanlanadi. */
export function TeacherTodayLessons() {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const query = useApiQuery<TeacherCabinetLesson[]>(`/teacher/me/schedule?from=${today}&to=${today}`);
    const [now, setNow] = useState(nowTimeInTashkent);
    const [active, setActive] = useState<TeacherCabinetLesson | null>(null);

    useInterval(() => setNow(nowTimeInTashkent()), 30_000);

    const lessons = query.data ?? [];
    const phases = lessonPhases(lessons, now);
    const current = lessons.find((_, index) => phases[index] === 'current');

    return (
        <section aria-labelledby="today-lessons" className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 id="today-lessons" className="font-heading text-lg font-bold">
                        {t('cabinet.today.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground">{formatDateLong(today)}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link to="/teacher/timetable">
                        <CalendarDays aria-hidden="true" />
                        {t('cabinet.timetable.open')}
                    </Link>
                </Button>
            </div>

            {query.loading && <LoadingState rows={3} />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {query.data && lessons.length === 0 && (
                <EmptyState icon={CalendarDays} title={t('cabinet.today.emptyTitle')} description={t('cabinet.today.empty')} />
            )}

            {current && !current.session?.topicTitle && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <p className="text-sm font-medium">
                        {t('cabinet.today.currentNoTopic', { name: `${current.class.name} · ${current.subject.nameUz}` })}
                    </p>
                    <Button type="button" size="sm" onClick={() => setActive(current)}>
                        {t('cabinet.lesson.chooseTopic')}
                    </Button>
                </div>
            )}

            <ol className="list-none space-y-2">
                {lessons.map((lesson, index) => {
                    const phase = phases[index];
                    return (
                        <li
                            key={`${lesson.lessonScheduleId}-${lesson.date}`}
                            className={cn(
                                'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center',
                                phase === 'current' && 'border-primary bg-primary/5',
                                phase === 'past' && 'opacity-75',
                            )}
                        >
                            <div className="flex items-center gap-3 sm:w-40">
                                <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">
                                    {lesson.lessonNumber}
                                </span>
                                <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                                    <Clock aria-hidden="true" className="size-3.5" />
                                    {lesson.startTime}–{lesson.endTime}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {lesson.class.name} · {lesson.subject.nameUz}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {lesson.session?.topicTitle ?? t('teacher.journal.noTopic')}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {phase === 'current' && <StatusBadge tone="success">{t('cabinet.today.now')}</StatusBadge>}
                                {phase === 'next' && <StatusBadge tone="info">{t('cabinet.today.next')}</StatusBadge>}
                                {lesson.session && (
                                    <StatusBadge tone="neutral" dot={false}>
                                        {t(`teacher.session.statuses.${lesson.session.status}`)}
                                    </StatusBadge>
                                )}
                                <Button type="button" size="sm" variant={phase === 'current' ? 'default' : 'outline'} onClick={() => setActive(lesson)}>
                                    <NotebookPen aria-hidden="true" />
                                    {lesson.session?.topicTitle ? t('cabinet.lesson.edit') : t('cabinet.lesson.chooseTopic')}
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ol>

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
        </section>
    );
}
