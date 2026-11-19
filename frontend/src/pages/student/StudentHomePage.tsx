import { CalendarDays, ClipboardList, Clock, DoorOpen, NotebookText } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { STUDENT_STATE_TONE } from '@/components/assessments/assessment-status';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, formatDateLong, formatTime, nowTimeInTashkent } from '@/lib/date';
import { lessonPhases } from '@/lib/lessons';
import { cn } from '@/lib/utils';
import type { StudentAssessmentItem } from '@/types/assessment';
import type { StudentOverview } from '@/types/cabinet';

export function StudentHomePage() {
    const { t } = useTranslation();
    const overview = useApiQuery<StudentOverview>('/student/me/overview');
    const tests = useApiQuery<StudentAssessmentItem[]>('/student/me/assessments');

    if (overview.loading) return <LoadingState rows={6} />;
    if (overview.error) return <ErrorState message={overview.error} onRetry={overview.retry} />;
    if (!overview.data) return null;

    const { profile, shift, lessons, homework, attendance, today } = overview.data;
    const phases = lessonPhases(lessons, nowTimeInTashkent());
    const openTests = (tests.data ?? []).filter((item) => item.state === 'OPEN' || item.state === 'IN_PROGRESS');

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('student.eyebrow')}
                title={t('student.home.greeting', { name: profile.firstName })}
                description={`${profile.schoolName} · ${t('student.home.classN', { name: profile.className })}${shift ? ` · ${t('classes.shift.nameN', { code: shift.code })} (${shift.startTime}–${shift.endTime})` : ''}`}
            />

            {openTests.length > 0 && (
                <section aria-label={t('student.home.openTests')} className="space-y-2">
                    {openTests.map((test) => (
                        <div key={test.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
                            <div className="min-w-0">
                                <p className="font-semibold">{test.title}</p>
                                <p className="text-sm text-muted-foreground">
                                    {test.subject} · {t('assessments.minutes', { count: test.durationMinutes })}
                                    {test.endsAt && ` · ${t('student.tests.until', { date: formatDate(test.endsAt), time: formatTime(test.endsAt) })}`}
                                </p>
                            </div>
                            <Button asChild>
                                <Link to={`/student/assessments/${test.id}`}>
                                    {test.state === 'IN_PROGRESS' ? t('student.tests.continue') : t('student.tests.start')}
                                </Link>
                            </Button>
                        </div>
                    ))}
                </section>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section aria-labelledby="student-today" className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 id="student-today" className="font-heading text-lg font-bold">
                                {t('cabinet.today.title')}
                            </h2>
                            <p className="text-sm text-muted-foreground">{formatDateLong(today)}</p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link to="/student/schedule">
                                <CalendarDays aria-hidden="true" />
                                {t('cabinet.timetable.open')}
                            </Link>
                        </Button>
                    </div>
                    {lessons.length === 0 ? (
                        <EmptyState icon={CalendarDays} title={t('cabinet.today.emptyTitle')} description={t('student.home.noLessons')} />
                    ) : (
                        <ol className="list-none space-y-2">
                            {lessons.map((lesson, index) => (
                                <li
                                    key={`${lesson.lessonNumber}-${lesson.startTime}`}
                                    className={cn(
                                        'flex items-start gap-3 rounded-xl border p-3',
                                        phases[index] === 'current' && 'border-primary bg-primary/5',
                                        phases[index] === 'past' && 'opacity-75',
                                    )}
                                >
                                    <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">
                                        {lesson.lessonNumber}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                                            {lesson.subject}
                                            {phases[index] === 'current' && <StatusBadge tone="success">{t('cabinet.today.now')}</StatusBadge>}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{lesson.topicTitle ?? t('student.home.topicPending')}</p>
                                        <p className="text-xs text-muted-foreground">{lesson.teacher}</p>
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground">
                                        <Clock aria-hidden="true" className="size-3.5" />
                                        {lesson.startTime}–{lesson.endTime}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                <div className="space-y-5">
                    <Card size="sm" className="gap-2 px-4">
                        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <DoorOpen aria-hidden="true" className="size-4" />
                            {t('student.home.attendanceToday')}
                        </p>
                        {attendance?.firstInTime ? (
                            <p className="font-heading text-lg font-bold">
                                {t('student.home.arrivedAt', { time: formatTime(attendance.firstInTime) })}
                                {attendance.lastOutTime && (
                                    <span className="block text-sm font-normal text-muted-foreground">
                                        {t('student.home.leftAt', { time: formatTime(attendance.lastOutTime) })}
                                    </span>
                                )}
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('student.home.notArrived')}</p>
                        )}
                        <Link to="/student/attendance" className="text-sm text-primary hover:underline">
                            {t('student.attendance.open')}
                        </Link>
                    </Card>

                    <section aria-labelledby="student-homework" className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                        <h2 id="student-homework" className="flex items-center gap-2 font-heading text-base font-bold">
                            <NotebookText aria-hidden="true" className="size-4" />
                            {t('student.home.homework')}
                        </h2>
                        {homework.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('student.home.noHomework')}</p>
                        ) : (
                            <ul className="list-none space-y-2">
                                {homework.map((item) => (
                                    <li key={`${item.date}-${item.lessonNumber}`} className="rounded-xl bg-muted/50 p-3 text-sm">
                                        <p className="font-semibold">
                                            {item.subject} <span className="font-normal text-muted-foreground">· {formatDate(item.date)}</span>
                                        </p>
                                        <p className="whitespace-pre-line">{item.homework}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
                        <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                            <ClipboardList aria-hidden="true" className="size-4" />
                            {t('student.tests.title')}
                        </h2>
                        {(tests.data ?? []).slice(0, 4).map((test) => (
                            <Link key={test.id} to={`/student/assessments/${test.id}`} className="flex items-center justify-between gap-2 rounded-lg p-2 text-sm hover:bg-muted/50">
                                <span className="min-w-0 truncate">{test.title}</span>
                                <StatusBadge tone={STUDENT_STATE_TONE[test.state]}>
                                    {test.grade ? t('student.test.grade', { grade: test.grade }) : t(`student.tests.states.${test.state}`)}
                                </StatusBadge>
                            </Link>
                        ))}
                        {tests.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('student.tests.empty')}</p>}
                        <Link to="/student/assessments" className="block text-sm text-primary hover:underline">
                            {t('student.tests.all')}
                        </Link>
                    </section>
                </div>
            </div>
        </div>
    );
}
