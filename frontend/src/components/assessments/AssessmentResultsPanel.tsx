import { useTranslation } from 'react-i18next';

import { GRADE_TONE } from '@/components/assessments/assessment-status';
import { KpiCard } from '@/components/common/KpiCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AssessmentResults } from '@/types/assessment';
import { Award, Percent, UsersRound } from 'lucide-react';

export function AssessmentResultsPanel({ assessmentId, live }: { assessmentId: number; live: boolean }) {
    const { t } = useTranslation();
    const query = useApiQuery<AssessmentResults>(`/teacher/me/assessments/${assessmentId}/results`);
    // Test ochiq paytda natijalar avtomatik yangilanadi.
    useInterval(query.retry, live ? 15_000 : null);

    if (query.loading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;

    const { summary, students, questions } = query.data;

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard icon={UsersRound} label={t('assessments.results.submitted')} value={`${summary.submitted} / ${summary.students}`} />
                <KpiCard
                    icon={Percent}
                    tone="success"
                    label={t('assessments.results.average')}
                    value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`}
                />
                <KpiCard
                    icon={Award}
                    label={t('assessments.results.grades')}
                    value={`5:${summary.grades['5']} · 4:${summary.grades['4']} · 3:${summary.grades['3']} · 2:${summary.grades['2']}`}
                />
            </div>

            <Card className="py-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 pl-5">{t('common.number')}</TableHead>
                            <TableHead>{t('assessments.results.student')}</TableHead>
                            <TableHead>{t('assessments.results.status')}</TableHead>
                            <TableHead className="text-right">{t('assessments.results.score')}</TableHead>
                            <TableHead className="pr-5 text-right">{t('assessments.results.grade')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map((student, index) => (
                            <TableRow key={student.personId}>
                                <TableCell className="pl-5 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                                <TableCell className="whitespace-normal">
                                    <span className="font-medium">
                                        {student.lastName} {student.firstName}
                                    </span>
                                    {student.submittedAt && (
                                        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(student.submittedAt)}</p>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <StatusBadge tone={student.status === 'SUBMITTED' ? 'success' : student.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>
                                        {t(`assessments.results.statuses.${student.status}`)}
                                    </StatusBadge>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {student.percent === null ? '—' : `${student.correctCount}/${student.totalCount} · ${student.percent}%`}
                                </TableCell>
                                <TableCell className="pr-5 text-right">
                                    {student.grade ? (
                                        <StatusBadge tone={GRADE_TONE[student.grade]} dot={false}>
                                            {student.grade}
                                        </StatusBadge>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <section className="space-y-2">
                <h3 className="font-heading text-base font-bold">{t('assessments.results.byQuestion')}</h3>
                <p className="text-sm text-muted-foreground">{t('assessments.results.byQuestionHint')}</p>
                <ol className="list-none space-y-1.5">
                    {questions.map((question) => (
                        <li key={question.id} className="flex items-center gap-3 text-sm">
                            <span className="w-8 shrink-0 font-semibold tabular-nums">{question.orderIndex}.</span>
                            <span className="min-w-0 flex-1 truncate" title={question.text}>
                                {question.text}
                            </span>
                            <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:w-40" aria-hidden="true">
                                <span
                                    className={cn(
                                        'block h-full rounded-full',
                                        (question.correctPercent ?? 0) >= 70 ? 'bg-success' : (question.correctPercent ?? 0) >= 40 ? 'bg-warning' : 'bg-destructive',
                                    )}
                                    style={{ width: `${question.correctPercent ?? 0}%` }}
                                />
                            </span>
                            <span className="w-14 shrink-0 text-right tabular-nums">
                                {question.correctPercent === null ? '—' : `${question.correctPercent}%`}
                            </span>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
