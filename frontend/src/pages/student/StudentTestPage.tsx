import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { GRADE_TONE } from '@/components/assessments/assessment-status';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedGet, authorizedPost, authorizedPut } from '@/lib/auth-session';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { StudentAssessmentItem, StudentAssessmentResult, StudentAttemptSession } from '@/types/assessment';

const LETTERS = ['A', 'B', 'C', 'D'];

function ResultView({ result }: { result: StudentAssessmentResult }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center shadow-sm">
                <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
                <p className="text-sm text-muted-foreground">{t('student.test.submittedAt', { date: formatDateTime(result.submittedAt) })}</p>
                <p className="font-heading text-4xl font-bold tabular-nums">{result.percent}%</p>
                <p className="text-muted-foreground">{t('student.test.correctOf', { correct: result.correctCount, total: result.totalCount })}</p>
                <StatusBadge tone={GRADE_TONE[result.grade]} dot={false}>
                    {t('student.test.grade', { grade: result.grade })}
                </StatusBadge>
            </div>

            {!result.revealed ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                    {t('student.test.answersLater', { date: result.answersAvailableAt ? formatDateTime(result.answersAvailableAt) : '—' })}
                </p>
            ) : (
                <ol className="list-none space-y-3">
                    {result.questions.map((question) => (
                        <li key={question.id} className="space-y-2 rounded-2xl border bg-card p-4">
                            <p className="font-medium whitespace-pre-line">
                                <span className="mr-1 font-bold">{question.number}.</span>
                                {question.text}
                            </p>
                            <ul className="grid list-none gap-1.5 sm:grid-cols-2">
                                {question.options.map((option, index) => {
                                    const correct = index === question.correctIndex;
                                    const chosen = index === question.chosenIndex;
                                    return (
                                        <li
                                            key={index}
                                            className={cn(
                                                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                                                correct && 'border-success/50 bg-success/10',
                                                chosen && !correct && 'border-destructive/50 bg-destructive/10',
                                            )}
                                        >
                                            <span className="font-semibold">{LETTERS[index]})</span>
                                            <span className="min-w-0 flex-1">{option}</span>
                                            {correct && <Check aria-label={t('assessments.question.correct')} className="size-4 text-success" />}
                                            {chosen && !correct && <X aria-label={t('student.test.yourAnswer')} className="size-4 text-destructive" />}
                                        </li>
                                    );
                                })}
                            </ul>
                            {question.chosenIndex === null && <p className="text-xs text-warning">{t('student.test.notAnswered')}</p>}
                            {question.explanation && <p className="text-xs text-muted-foreground">{question.explanation}</p>}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

function useCountdown(deadline: number | null, offset: number) {
    const [now, setNow] = useState(() => Date.now() + offset);
    useEffect(() => {
        if (deadline === null) return;
        const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
        return () => window.clearInterval(id);
    }, [deadline, offset]);
    return deadline === null ? null : Math.max(0, deadline - now);
}

function TestRunner({ session, onFinished }: { session: StudentAttemptSession; onFinished: (result: StudentAssessmentResult) => void }) {
    const { t } = useTranslation();
    // Server va qurilma soati farqi — taymer server vaqtiga bog‘lanadi.
    const [offset] = useState(() => new Date(session.serverNow).getTime() - Date.now());
    const deadline = new Date(session.deadlineAt).getTime();
    const remaining = useCountdown(deadline, offset);
    const [answers, setAnswers] = useState<Record<string, number>>(session.answers);
    const [current, setCurrent] = useState(0);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const saveTimer = useRef<number | undefined>(undefined);
    const submitted = useRef(false);

    const submit = useCallback(
        async (final: Record<string, number>) => {
            if (submitted.current) return;
            submitted.current = true;
            setSubmitting(true);
            setError('');
            window.clearTimeout(saveTimer.current);
            try {
                onFinished(await authorizedPost<StudentAssessmentResult>(`/student/me/assessments/${session.id}/submit`, { answers: final }));
            } catch (err: unknown) {
                submitted.current = false;
                setError(err instanceof Error ? err.message : t('student.test.submitFailed'));
            } finally {
                setSubmitting(false);
            }
        },
        [session.id, onFinished, t],
    );

    // Vaqt tugasa — avtomatik topshiriladi (oxirgi tanlangan javoblar bilan).
    const latestAnswers = useRef(answers);
    useEffect(() => {
        latestAnswers.current = answers;
    }, [answers]);
    useEffect(() => {
        const id = window.setInterval(() => {
            if (Date.now() + offset >= deadline) void submit(latestAnswers.current);
        }, 1000);
        return () => window.clearInterval(id);
    }, [deadline, offset, submit]);

    useEffect(() => () => window.clearTimeout(saveTimer.current), []);

    function choose(questionId: number, option: number) {
        const next = { ...answers, [String(questionId)]: option };
        setAnswers(next);
        setSaveState('saving');
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            authorizedPut(`/student/me/assessments/${session.id}/answers`, { answers: next })
                .then(() => setSaveState('saved'))
                .catch(() => setSaveState('error'));
        }, 700);
    }

    const question = session.questions[current];
    const answered = session.questions.filter((item) => answers[String(item.id)] !== undefined).length;
    const minutes = remaining === null ? 0 : Math.floor(remaining / 60000);
    const seconds = remaining === null ? 0 : Math.floor((remaining % 60000) / 1000);

    return (
        <div className="space-y-5">
            <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur">
                <span
                    role="timer"
                    aria-live="off"
                    className={cn('flex items-center gap-2 font-heading text-xl font-bold tabular-nums', remaining !== null && remaining < 60_000 && 'text-destructive')}
                >
                    <Clock aria-hidden="true" className="size-5" />
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
                <span className="text-sm text-muted-foreground">
                    {t('student.test.answered', { count: answered, total: session.questions.length })}
                    {saveState === 'saving' && ` · ${t('student.test.saving')}`}
                    {saveState === 'saved' && ` · ${t('student.test.saved')}`}
                    {saveState === 'error' && ` · ${t('student.test.saveError')}`}
                </span>
                <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                        const left = session.questions.length - answered;
                        if (left === 0 || window.confirm(t('student.test.confirmUnanswered', { count: left }))) void submit(answers);
                    }}
                >
                    {submitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                    {t('student.test.submit')}
                </Button>
            </div>

            {error && <ErrorState message={error} />}

            <nav aria-label={t('student.test.navigator')} className="flex flex-wrap gap-1.5">
                {session.questions.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrent(index)}
                        aria-current={index === current ? 'step' : undefined}
                        aria-label={t('student.test.goTo', { n: item.number })}
                        className={cn(
                            'grid size-9 place-items-center rounded-lg border text-sm font-semibold tabular-nums transition-colors',
                            answers[String(item.id)] !== undefined && 'border-primary/50 bg-primary/10',
                            index === current && 'ring-2 ring-primary',
                        )}
                    >
                        {item.number}
                    </button>
                ))}
            </nav>

            {question && (
                <fieldset className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                    <legend className="sr-only">{t('student.test.questionN', { n: question.number })}</legend>
                    <p className="text-lg font-medium whitespace-pre-line">
                        <span className="mr-1 font-bold">{question.number}.</span>
                        {question.text}
                    </p>
                    <div className="grid gap-2">
                        {question.options.map((option, index) => {
                            const selected = answers[String(question.id)] === index;
                            return (
                                <label
                                    key={index}
                                    className={cn(
                                        'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                                        selected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name={`q-${question.id}`}
                                        checked={selected}
                                        onChange={() => choose(question.id, index)}
                                        className="size-4 accent-primary"
                                        disabled={submitting}
                                    />
                                    <span className="font-semibold">{LETTERS[index]})</span>
                                    <span>{option}</span>
                                </label>
                            );
                        })}
                    </div>
                    <div className="flex justify-between gap-2 pt-2">
                        <Button type="button" variant="outline" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}>
                            {t('student.test.prev')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={current === session.questions.length - 1}
                            onClick={() => setCurrent((value) => value + 1)}
                        >
                            {t('student.test.next')}
                        </Button>
                    </div>
                </fieldset>
            )}
        </div>
    );
}

export function StudentTestPage() {
    const { t } = useTranslation();
    const params = useParams();
    const id = Number(params.id);
    const list = useApiQuery<StudentAssessmentItem[]>('/student/me/assessments');
    const [session, setSession] = useState<StudentAttemptSession | null>(null);
    const [result, setResult] = useState<StudentAssessmentResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const item = list.data?.find((test) => test.id === id);

    const start = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            setSession(await authorizedPost<StudentAttemptSession>(`/student/me/assessments/${id}/start`, {}));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('student.test.startFailed'));
        } finally {
            setBusy(false);
        }
    }, [id, t]);

    // Davom etayotgan test — darhol ochiladi; topshirilgan — natija yuklanadi.
    useEffect(() => {
        if (!item || session || result) return;
        const controller = new AbortController();
        if (item.state === 'IN_PROGRESS') {
            authorizedPost<StudentAttemptSession>(`/student/me/assessments/${id}/start`, {})
                .then((data) => !controller.signal.aborted && setSession(data))
                .catch((err: unknown) => !controller.signal.aborted && setError(err instanceof Error ? err.message : ''));
        } else if (item.state === 'SUBMITTED') {
            authorizedGet<StudentAssessmentResult>(`/student/me/assessments/${id}/result`, controller.signal)
                .then(setResult)
                .catch((err: unknown) => !controller.signal.aborted && setError(err instanceof Error ? err.message : ''));
        }
        return () => controller.abort();
    }, [item, id, session, result]);

    const back = (
        <Button asChild variant="ghost" size="sm">
            <Link to="/student/assessments">
                <ArrowLeft aria-hidden="true" />
                {t('student.tests.title')}
            </Link>
        </Button>
    );

    if (list.loading) return <LoadingState rows={6} />;
    if (list.error) return <ErrorState message={list.error} onRetry={list.retry} />;
    if (!item) {
        return (
            <div className="space-y-4">
                {back}
                <ErrorState message={t('student.test.notFound')} />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5">
            {back}
            <PageHeader
                eyebrow={`${item.type} · ${item.subject}`}
                title={item.title}
                description={t('assessments.minutes', { count: item.durationMinutes })}
            />

            {error && <ErrorState message={error} />}

            {result ? (
                <ResultView result={result} />
            ) : session ? (
                <TestRunner session={session} onFinished={setResult} />
            ) : item.state === 'OPEN' ? (
                <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-muted-foreground">{t('student.test.intro', { minutes: item.durationMinutes })}</p>
                    <ul className="mx-auto max-w-md list-disc space-y-1 pl-5 text-left text-sm text-muted-foreground">
                        <li>{t('student.test.rule1')}</li>
                        <li>{t('student.test.rule2')}</li>
                        <li>{t('student.test.rule3')}</li>
                    </ul>
                    <Button type="button" size="lg" onClick={() => void start()} disabled={busy}>
                        {busy ? t('common.loading') : t('student.tests.start')}
                    </Button>
                </div>
            ) : item.state === 'UPCOMING' ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm">{t('student.test.upcoming', { date: item.startsAt ? formatDateTime(item.startsAt) : '—' })}</p>
            ) : item.state === 'MISSED' ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm">{t('student.test.missed')}</p>
            ) : (
                <LoadingState rows={4} />
            )}
        </div>
    );
}
