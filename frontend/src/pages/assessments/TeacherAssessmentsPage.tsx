import { useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { CreateAssessmentForm, type TeacherAssignmentOption } from '@/components/assessments/CreateAssessmentForm';
import { STATUS_TONE } from '@/components/assessments/assessment-status';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime } from '@/lib/date';
import type { AssessmentListItem } from '@/types/assessment';

export function TeacherAssessmentsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [creating, setCreating] = useState(false);
    const assignmentFilter = searchParams.get('assignmentId') ?? '';

    const assignments = useApiQuery<TeacherAssignmentOption[]>('/teacher/me/assignments');
    const list = useApiQuery<AssessmentListItem[]>(
        `/teacher/me/assessments${assignmentFilter ? `?assignmentId=${assignmentFilter}` : ''}`,
    );

    const generating = (list.data ?? []).some((item) => item.status === 'GENERATING');
    useInterval(list.retry, generating ? 4000 : null);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('teacher.eyebrow')}
                title={t('assessments.title')}
                description={t('assessments.subtitle')}
                actions={
                    <Button type="button" className="w-full sm:w-auto" onClick={() => setCreating(true)} disabled={!assignments.data?.length}>
                        <Plus aria-hidden="true" />
                        {t('assessments.create.open')}
                    </Button>
                }
            />

            <div className="rounded-2xl border bg-card p-4 shadow-sm sm:max-w-md">
                <SelectField
                    value={assignmentFilter}
                    onValueChange={(value) => setSearchParams(value ? { assignmentId: value } : {})}
                    emptyOption={t('assessments.allAssignments')}
                    aria-label={t('assessments.create.assignment')}
                    options={(assignments.data ?? []).map((item) => ({
                        value: String(item.id),
                        label: `${item.class.name} · ${item.subject.nameUz}`,
                    }))}
                />
            </div>

            {list.loading && <LoadingState rows={5} />}
            {list.error && <ErrorState message={list.error} onRetry={list.retry} />}
            {list.data && list.data.length === 0 && (
                <EmptyState
                    icon={ClipboardList}
                    title={t('assessments.emptyTitle')}
                    description={t('assessments.empty')}
                    action={
                        <Button type="button" onClick={() => setCreating(true)} disabled={!assignments.data?.length}>
                            <Plus aria-hidden="true" />
                            {t('assessments.create.open')}
                        </Button>
                    }
                />
            )}

            <ul className="grid list-none gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(list.data ?? []).map((item) => (
                    <li key={item.id}>
                        <Card size="sm" className="h-full gap-3 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone="primary" dot={false}>
                                    {item.type}
                                    {item.quarter ? ` · ${t('assessments.quarterN', { n: item.quarter })}` : ''}
                                </StatusBadge>
                                <StatusBadge tone={STATUS_TONE[item.status]}>{t(`assessments.status.${item.status}`)}</StatusBadge>
                            </div>
                            <Link to={`/teacher/assessments/${item.id}`} className="font-heading text-base font-bold hover:underline">
                                {item.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                                {item.class.name} · {item.subject.nameUz} · {t('assessments.questionsN', { count: item.questionCount })} ·{' '}
                                {t('assessments.minutes', { count: item.durationMinutes })}
                            </p>
                            {item.startsAt && item.endsAt && (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {formatDateTime(item.startsAt)} — {formatDateTime(item.endsAt)}
                                </p>
                            )}
                            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-sm">
                                <span className="text-muted-foreground">
                                    {t('assessments.submittedN', { count: item.submitted })}
                                    {item.averagePercent !== null && ` · ${t('assessments.average', { value: item.averagePercent })}`}
                                </span>
                                <Button asChild size="sm" variant="outline">
                                    <Link to={`/teacher/assessments/${item.id}`}>{t('assessments.open')}</Link>
                                </Button>
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('assessments.create.title')}</DialogTitle>
                        <DialogDescription>{t('assessments.create.description')}</DialogDescription>
                    </DialogHeader>
                    {creating && assignments.data && (
                        <CreateAssessmentForm
                            assignments={assignments.data}
                            {...(assignmentFilter ? { initialAssignmentId: Number(assignmentFilter) } : {})}
                            onCancel={() => setCreating(false)}
                            onCreated={(id) => navigate(`/teacher/assessments/${id}`)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
