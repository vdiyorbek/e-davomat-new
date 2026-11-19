import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { GRADE_TONE, STUDENT_STATE_TONE } from '@/components/assessments/assessment-status';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime } from '@/lib/date';
import type { StudentAssessmentItem } from '@/types/assessment';

export function StudentAssessmentsPage() {
    const { t } = useTranslation();
    const query = useApiQuery<StudentAssessmentItem[]>('/student/me/assessments');

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('student.eyebrow')} title={t('student.tests.title')} description={t('student.tests.description')} />
            {query.loading && <LoadingState rows={5} />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {query.data?.length === 0 && <EmptyState icon={ClipboardList} title={t('student.tests.emptyTitle')} description={t('student.tests.empty')} />}

            <ul className="grid list-none gap-3 md:grid-cols-2">
                {(query.data ?? []).map((test) => (
                    <li key={test.id}>
                        <Card size="sm" className="h-full gap-3 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone="primary" dot={false}>
                                    {test.type}
                                    {test.quarter ? ` · ${t('assessments.quarterN', { n: test.quarter })}` : ''}
                                </StatusBadge>
                                <StatusBadge tone={STUDENT_STATE_TONE[test.state]}>{t(`student.tests.states.${test.state}`)}</StatusBadge>
                            </div>
                            <p className="font-heading text-base font-bold">{test.title}</p>
                            <p className="text-sm text-muted-foreground">
                                {test.subject} · {t('assessments.minutes', { count: test.durationMinutes })}
                            </p>
                            {test.startsAt && test.endsAt && (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {formatDateTime(test.startsAt)} — {formatDateTime(test.endsAt)}
                                </p>
                            )}
                            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                                {test.grade ? (
                                    <span className="flex items-center gap-2 text-sm">
                                        {t('student.tests.yourGrade')}
                                        <StatusBadge tone={GRADE_TONE[test.grade]} dot={false}>
                                            {test.grade} · {test.percent}%
                                        </StatusBadge>
                                    </span>
                                ) : (
                                    <span />
                                )}
                                {(test.state === 'OPEN' || test.state === 'IN_PROGRESS' || test.state === 'SUBMITTED') && (
                                    <Button asChild size="sm" variant={test.state === 'SUBMITTED' ? 'outline' : 'default'}>
                                        <Link to={`/student/assessments/${test.id}`}>
                                            {test.state === 'SUBMITTED'
                                                ? t('student.tests.viewResult')
                                                : test.state === 'IN_PROGRESS'
                                                  ? t('student.tests.continue')
                                                  : t('student.tests.start')}
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>
        </div>
    );
}
