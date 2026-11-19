import { useId, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Lock, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AssessmentResultsPanel } from '@/components/assessments/AssessmentResultsPanel';
import { QuestionCard } from '@/components/assessments/QuestionCard';
import { STATUS_TONE, fromLocalInput, toLocalInput } from '@/components/assessments/assessment-status';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedDelete, authorizedPost } from '@/lib/auth-session';
import { formatDateTime } from '@/lib/date';
import type { AssessmentDetail } from '@/types/assessment';

function PublishForm({ assessment, onDone }: { assessment: AssessmentDetail; onDone: () => void }) {
    const { t } = useTranslation();
    const ids = useId();
    const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
    const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600_000)));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function publish() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await authorizedPost(`/teacher/me/assessments/${assessment.id}/publish`, {
                startsAt: fromLocalInput(startsAt),
                endsAt: fromLocalInput(endsAt),
            });
            onDone();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('assessments.publish.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm print:hidden">
            <h2 className="font-heading text-base font-bold">{t('assessments.publish.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('assessments.publish.hint', { minutes: assessment.durationMinutes })}</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field htmlFor={`${ids}-start`} label={t('assessments.publish.startsAt')}>
                    <Input id={`${ids}-start`} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={busy} />
                </Field>
                <Field htmlFor={`${ids}-end`} label={t('assessments.publish.endsAt')}>
                    <Input id={`${ids}-end`} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} disabled={busy} />
                </Field>
            </div>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            <Button type="button" onClick={() => void publish()} disabled={busy || assessment.questions.length < 3}>
                <Send aria-hidden="true" />
                {busy ? t('common.saving') : t('assessments.publish.submit')}
            </Button>
        </section>
    );
}

/** Chop etish: o‘quvchilar uchun (javobsiz) yoki o‘qituvchi uchun (kalit bilan). */
function printAssessment(withAnswers: boolean) {
    const body = document.body;
    body.classList.add('printing-assessment');
    if (!withAnswers) body.classList.add('hide-answer-key');
    const cleanup = () => {
        body.classList.remove('printing-assessment', 'hide-answer-key');
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
}

export function TeacherAssessmentPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const params = useParams();
    const id = Number(params.id);
    const valid = Number.isSafeInteger(id) && id > 0;
    const query = useApiQuery<AssessmentDetail>(valid ? `/teacher/me/assessments/${id}` : '/teacher/me/assessments/0');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);
    const acting = useRef(false);

    const assessment = query.data;
    useInterval(query.retry, assessment?.status === 'GENERATING' ? 3000 : null);

    async function act(action: () => Promise<unknown>, after?: () => void) {
        if (acting.current) return;
        acting.current = true;
        setBusy(true);
        setActionError('');
        try {
            await action();
            if (after) after();
            else query.retry();
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : t('common.loadFailed'));
        } finally {
            acting.current = false;
            setBusy(false);
        }
    }

    const back = (
        <Button asChild variant="ghost" size="sm" className="print:hidden">
            <Link to="/teacher/assessments">
                <ArrowLeft aria-hidden="true" />
                {t('assessments.back')}
            </Link>
        </Button>
    );

    if (!valid) return <ErrorState message={t('common.invalidUrl')} />;
    if (query.loading) return <LoadingState rows={6} />;
    if (query.error || !assessment) {
        return (
            <div className="space-y-4">
                {back}
                <ErrorState message={query.error} onRetry={query.retry} />
            </div>
        );
    }

    const editable = assessment.status === 'DRAFT';
    const hasResults = assessment.status === 'PUBLISHED' || assessment.status === 'CLOSED';

    const questions = (
        <div className="space-y-3">
            {/* Chop etilganda varaq boshida chiqadigan sarlavha */}
            <div className="hidden print:block">
                <p className="text-sm">
                    {assessment.school.name} · {assessment.class.name} · {assessment.subject.nameUz}
                </p>
                <h1 className="text-xl font-bold">{assessment.title}</h1>
                <p className="mb-4 text-sm">{t('assessments.print.studentLine')}</p>
            </div>
            {assessment.questions.map((question, index) => (
                <QuestionCard
                    key={`${question.id}-${question.text}-${question.correctIndex}`}
                    assessmentId={assessment.id}
                    question={question}
                    number={index + 1}
                    editable={editable}
                    onChanged={query.retry}
                />
            ))}
        </div>
    );

    return (
        <div className="w-full min-w-0 space-y-6">
            {back}
            <div className="print:hidden">
                <PageHeader
                    eyebrow={`${assessment.type}${assessment.quarter ? ` · ${t('assessments.quarterN', { n: assessment.quarter })}` : ''}`}
                    title={assessment.title}
                    description={`${assessment.class.name} · ${assessment.subject.nameUz} · ${t('assessments.questionsN', { count: assessment.questions.length })} · ${t('assessments.minutes', { count: assessment.durationMinutes })}`}
                    actions={<StatusBadge tone={STATUS_TONE[assessment.status]}>{t(`assessments.status.${assessment.status}`)}</StatusBadge>}
                />
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground print:hidden">
                {assessment.topics.map((topic) => (
                    <StatusBadge key={topic.id} tone="neutral" dot={false}>
                        {topic.title}
                    </StatusBadge>
                ))}
            </div>

            {assessment.status === 'GENERATING' && (
                <div role="status" className="flex items-center gap-3 rounded-2xl border bg-card p-5">
                    <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
                    <div>
                        <p className="font-medium">{t('assessments.generating.title')}</p>
                        <p className="text-sm text-muted-foreground">{t('assessments.generating.hint')}</p>
                    </div>
                </div>
            )}

            {assessment.status === 'FAILED' && <ErrorState message={assessment.generationError ?? t('assessments.generating.failed')} />}

            {assessment.startsAt && assessment.endsAt && (
                <p className="text-sm tabular-nums print:hidden">
                    {t('assessments.window', { from: formatDateTime(assessment.startsAt), to: formatDateTime(assessment.endsAt) })}
                </p>
            )}

            <div className="flex flex-wrap gap-2 print:hidden">
                {(assessment.status === 'DRAFT' || assessment.status === 'FAILED') && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                            if (assessment.status === 'FAILED' || window.confirm(t('assessments.actions.confirmRegenerate'))) {
                                void act(() => authorizedPost(`/teacher/me/assessments/${assessment.id}/regenerate`, {}));
                            }
                        }}
                    >
                        <RefreshCw aria-hidden="true" />
                        {t('assessments.actions.regenerate')}
                    </Button>
                )}
                {assessment.questions.length > 0 && (
                    <>
                        <Button type="button" variant="outline" onClick={() => printAssessment(false)}>
                            <Printer aria-hidden="true" />
                            {t('assessments.print.forStudents')}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => printAssessment(true)}>
                            <Printer aria-hidden="true" />
                            {t('assessments.print.withKey')}
                        </Button>
                    </>
                )}
                {assessment.status === 'PUBLISHED' && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                            if (window.confirm(t('assessments.actions.confirmClose'))) {
                                void act(() => authorizedPost(`/teacher/me/assessments/${assessment.id}/close`, {}));
                            }
                        }}
                    >
                        <Lock aria-hidden="true" />
                        {t('assessments.actions.close')}
                    </Button>
                )}
                {assessment.status !== 'GENERATING' && (
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        className="text-destructive"
                        onClick={() => {
                            if (window.confirm(t('assessments.actions.confirmDelete'))) {
                                void act(
                                    () => authorizedDelete(`/teacher/me/assessments/${assessment.id}`),
                                    () => navigate('/teacher/assessments'),
                                );
                            }
                        }}
                    >
                        <Trash2 aria-hidden="true" />
                        {t('assessments.actions.delete')}
                    </Button>
                )}
            </div>

            {actionError && <ErrorState message={actionError} />}

            {editable && <PublishForm assessment={assessment} onDone={query.retry} />}

            {hasResults ? (
                <Tabs defaultValue="results">
                    <TabsList className="print:hidden">
                        <TabsTrigger value="results">{t('assessments.tabs.results')}</TabsTrigger>
                        <TabsTrigger value="questions">{t('assessments.tabs.questions')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="results" className="pt-4 print:hidden">
                        <AssessmentResultsPanel assessmentId={assessment.id} live={assessment.status === 'PUBLISHED'} />
                    </TabsContent>
                    <TabsContent value="questions" className="pt-4">
                        {questions}
                    </TabsContent>
                </Tabs>
            ) : (
                assessment.questions.length > 0 && (
                    <section className="space-y-3">
                        {editable && <p className="text-sm text-muted-foreground print:hidden">{t('assessments.reviewHint')}</p>}
                        {questions}
                    </section>
                )
            )}
        </div>
    );
}
