import { useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AssessmentDifficulty, AssessmentTopic, AssessmentType } from '@/types/assessment';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface TeacherAssignmentOption {
    id: number;
    class: { id: number; name: string; gradeLevel: number | null };
    subject: { id: number; nameUz: string };
    school: { name: string };
}

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30, 40];
const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 80, 90];

function TopicPicker({
    assignmentId,
    type,
    selected,
    onChange,
}: {
    assignmentId: number;
    type: AssessmentType;
    selected: Set<number>;
    onChange: (ids: Set<number>) => void;
}) {
    const { t } = useTranslation();
    const query = useApiQuery<AssessmentTopic[]>(`/teacher/me/assignments/${assignmentId}/assessment-topics`);
    const topics = useMemo(() => query.data ?? [], [query.data]);

    // Bob bo‘yicha guruhlash (darslik ichida).
    const chapters = useMemo(() => {
        const groups: { key: string; title: string; topics: AssessmentTopic[] }[] = [];
        for (const topic of topics) {
            const key = `${topic.textbookId}:${topic.chapterTitle ?? ''}`;
            let group = groups.find((item) => item.key === key);
            if (!group) {
                group = { key, title: topic.chapterTitle ?? topic.textbookTitle, topics: [] };
                groups.push(group);
            }
            group.topics.push(topic);
        }
        return groups;
    }, [topics]);

    if (query.loading) return <LoadingState rows={4} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (topics.length === 0) {
        return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t('assessments.create.noTopics')}</p>;
    }

    function toggle(ids: number[], checked: boolean) {
        let next = new Set(selected);
        // BSB — bitta bo‘lim: boshqa bobdan tanlansa, avvalgi tanlov tozalanadi.
        if (type === 'BSB' && checked) {
            const chapterOf = (id: number) => chapters.find((group) => group.topics.some((topic) => topic.id === id))?.key;
            const target = chapterOf(ids[0]);
            if ([...selected].some((id) => chapterOf(id) !== target)) next = new Set();
        }
        for (const id of ids) {
            if (checked) next.add(id);
            else next.delete(id);
        }
        onChange(next);
    }

    const taught = topics.filter((topic) => topic.taughtOn).map((topic) => topic.id);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('assessments.create.selected', { count: selected.size })}</span>
                {type === 'CHSB' && taught.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onChange(new Set(taught))}>
                        {t('assessments.create.selectTaught', { count: taught.length })}
                    </Button>
                )}
                {selected.size > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(new Set())}>
                        {t('classes.shift.clearSelection')}
                    </Button>
                )}
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border p-3">
                {chapters.map((chapter) => {
                    const ids = chapter.topics.map((topic) => topic.id);
                    const count = ids.filter((id) => selected.has(id)).length;
                    return (
                        <fieldset key={chapter.key} className="space-y-1.5">
                            <legend className="flex w-full items-center gap-2 text-sm font-semibold">
                                <Checkbox
                                    checked={count === ids.length ? true : count > 0 ? 'indeterminate' : false}
                                    onCheckedChange={(checked) => toggle(ids, checked === true)}
                                    aria-label={t('assessments.create.selectChapter', { name: chapter.title })}
                                />
                                {chapter.title}
                            </legend>
                            {chapter.topics.map((topic) => (
                                <Label key={topic.id} className="flex cursor-pointer items-start gap-2 rounded-lg py-1 pl-6 text-sm hover:bg-muted/50">
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={selected.has(topic.id)}
                                        onCheckedChange={(checked) => toggle([topic.id], checked === true)}
                                    />
                                    <span className="min-w-0 flex-1">
                                        {topic.orderIndex}. {topic.title}
                                        {topic.pageStart && <span className="text-muted-foreground"> · {t('textbooks.pdf.pageN', { page: topic.pageStart })}</span>}
                                    </span>
                                    {topic.taughtOn && (
                                        <StatusBadge tone="success" dot={false}>
                                            {t('assessments.create.taughtOn', { date: formatDate(topic.taughtOn) })}
                                        </StatusBadge>
                                    )}
                                </Label>
                            ))}
                        </fieldset>
                    );
                })}
            </div>
        </div>
    );
}

/** AI yordamida CHSB/BSB test yaratish: fan-sinf, mavzular, savollar soni, qiyinlik. */
export function CreateAssessmentForm({
    assignments,
    initialAssignmentId,
    onCancel,
    onCreated,
}: {
    assignments: TeacherAssignmentOption[];
    initialAssignmentId?: number;
    onCancel: () => void;
    onCreated: (id: number) => void;
}) {
    const { t } = useTranslation();
    const ids = useId();
    const [assignmentId, setAssignmentId] = useState(String(initialAssignmentId ?? assignments[0]?.id ?? ''));
    const [type, setType] = useState<AssessmentType>('CHSB');
    const [quarter, setQuarter] = useState('1');
    const [topics, setTopics] = useState<Set<number>>(new Set());
    const [questionCount, setQuestionCount] = useState('20');
    const [difficulty, setDifficulty] = useState<AssessmentDifficulty>('MEDIUM');
    const [duration, setDuration] = useState('40');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);

    const assignment = assignments.find((item) => String(item.id) === assignmentId);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (saving.current || !assignment) return;
        if (topics.size === 0) {
            setError(t('assessments.create.chooseTopics'));
            return;
        }
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            const created = await authorizedPost<{ id: number }>('/teacher/me/assessments', {
                assignmentId: assignment.id,
                type,
                ...(type === 'CHSB' ? { quarter: Number(quarter) } : {}),
                topicIds: [...topics],
                questionCount: Number(questionCount),
                difficulty,
                durationMinutes: Number(duration),
            });
            onCreated(created.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('assessments.create.failed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field htmlFor={`${ids}-assignment`} label={t('assessments.create.assignment')}>
                <SelectField
                    id={`${ids}-assignment`}
                    value={assignmentId}
                    onValueChange={(value) => {
                        setAssignmentId(value);
                        setTopics(new Set());
                    }}
                    disabled={busy}
                    options={assignments.map((item) => ({
                        value: String(item.id),
                        label: `${item.class.name} · ${item.subject.nameUz} — ${item.school.name}`,
                    }))}
                />
            </Field>

            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('assessments.create.type')}</legend>
                <RadioGroup
                    value={type}
                    onValueChange={(next) => {
                        setType(next as typeof type);
                        setTopics(new Set());
                    }}
                    className="sm:grid-cols-2"
                >
                    {(['CHSB', 'BSB'] as const).map((value) => (
                        <Label
                            key={value}
                            className={cn(
                                'flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors',
                                type === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                            )}
                        >
                            <span className="flex items-center gap-2 font-semibold">
                                <RadioGroupItem value={value} />
                                {t(`assessments.types.${value}`)}
                            </span>
                            <span className="text-xs text-muted-foreground">{t(`assessments.typeHints.${value}`)}</span>
                        </Label>
                    ))}
                </RadioGroup>
            </fieldset>

            {type === 'CHSB' && (
                <Field htmlFor={`${ids}-quarter`} label={t('assessments.quarter')} className="sm:max-w-xs">
                    <SelectField
                        id={`${ids}-quarter`}
                        value={quarter}
                        onValueChange={setQuarter}
                        options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: t('assessments.quarterN', { n: value }) }))}
                    />
                </Field>
            )}

            <div className="space-y-2">
                <p className="text-sm font-medium">{type === 'BSB' ? t('assessments.create.topicsBsb') : t('assessments.create.topics')}</p>
                {assignment && assignment.class.gradeLevel == null ? (
                    <p className="text-sm text-destructive">{t('assessments.create.noGrade')}</p>
                ) : assignment ? (
                    <TopicPicker key={`${assignment.id}-${type}`} assignmentId={assignment.id} type={type} selected={topics} onChange={setTopics} />
                ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Field htmlFor={`${ids}-count`} label={t('assessments.create.questionCount')}>
                    <SelectField
                        id={`${ids}-count`}
                        value={questionCount}
                        onValueChange={setQuestionCount}
                        options={QUESTION_COUNTS.map((value) => ({ value: String(value), label: String(value) }))}
                    />
                </Field>
                <Field htmlFor={`${ids}-difficulty`} label={t('assessments.create.difficulty')}>
                    <SelectField
                        id={`${ids}-difficulty`}
                        value={difficulty}
                        onValueChange={(value) => setDifficulty(value as AssessmentDifficulty)}
                        options={(['EASY', 'MEDIUM', 'HARD'] as const).map((value) => ({
                            value,
                            label: t(`assessments.difficulty.${value}`),
                        }))}
                    />
                </Field>
                <Field htmlFor={`${ids}-duration`} label={t('assessments.create.duration')}>
                    <SelectField
                        id={`${ids}-duration`}
                        value={duration}
                        onValueChange={setDuration}
                        options={DURATIONS.map((value) => ({ value: String(value), label: t('assessments.minutes', { count: value }) }))}
                    />
                </Field>
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">{t('assessments.create.aiNote')}</p>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy || !assignment}>
                    <Sparkles aria-hidden="true" />
                    {busy ? t('assessments.create.submitting') : t('assessments.create.submit')}
                </Button>
            </div>
        </form>
    );
}
