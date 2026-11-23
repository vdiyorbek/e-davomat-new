import { useRef, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authorizedDelete, authorizedPatch } from '@/lib/auth-session';
import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@/types/assessment';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useConfirm } from '@/components/common/ConfirmDialog';

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuestionCard({
    assessmentId,
    question,
    number,
    editable,
    onChanged,
}: {
    assessmentId: number;
    question: AssessmentQuestion;
    number: number;
    editable: boolean;
    onChanged: () => void;
}) {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(question.text);
    const [options, setOptions] = useState(question.options);
    const [correct, setCorrect] = useState(question.correctIndex);
    const [explanation, setExplanation] = useState(question.explanation ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const saving = useRef(false);

    async function run(action: () => Promise<unknown>) {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            await action();
            setEditing(false);
            onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('assessments.question.saveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    if (editing) {
        return (
            <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4">
                <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    aria-label={t('assessments.question.text')}
                    maxLength={2000}
                    disabled={busy}
                />
                <fieldset className="space-y-2">
                    <legend className="text-xs text-muted-foreground">{t('assessments.question.markCorrect')}</legend>
                    <RadioGroup value={String(correct)} onValueChange={(next) => setCorrect(Number(next))} disabled={busy}>
                    {options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <RadioGroupItem value={String(index)} aria-label={t('assessments.question.correctOption', { letter: LETTERS[index] })} />
                            <span className="w-5 text-sm font-semibold">{LETTERS[index]}</span>
                            <Input
                                value={option}
                                maxLength={500}
                                disabled={busy}
                                aria-label={t('assessments.question.option', { letter: LETTERS[index] })}
                                onChange={(event) =>
                                    setOptions((items) => items.map((item, i) => (i === index ? event.target.value : item)))
                                }
                            />
                        </div>
                    ))}
                    </RadioGroup>
                </fieldset>
                <Textarea
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    placeholder={t('assessments.question.explanation')}
                    aria-label={t('assessments.question.explanation')}
                    maxLength={2000}
                    disabled={busy}
                />
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            void run(() =>
                                authorizedPatch(`/teacher/me/assessments/${assessmentId}/questions/${question.id}`, {
                                    text,
                                    options,
                                    correctIndex: correct,
                                    explanation: explanation.trim() || null,
                                }),
                            )
                        }
                    >
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <article className="space-y-3 rounded-2xl border bg-card p-4 break-inside-avoid">
            {dialog}
            <div className="flex items-start justify-between gap-3">
                <p className="font-medium whitespace-pre-line">
                    <span className="mr-1 font-bold">{number}.</span>
                    {question.text}
                </p>
                {editable && (
                    <div className="flex shrink-0 gap-1 print:hidden">
                        <Button type="button" variant="ghost" size="icon" aria-label={t('assessments.question.edit', { n: number })} onClick={() => setEditing(true)}>
                            <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={t('assessments.question.delete', { n: number })}
                            onClick={async () => {
                                if (await confirm({ title: t('assessments.question.confirmDelete'), destructive: true })) {
                                    void run(() => authorizedDelete(`/teacher/me/assessments/${assessmentId}/questions/${question.id}`));
                                }
                            }}
                        >
                            <Trash2 aria-hidden="true" />
                        </Button>
                    </div>
                )}
            </div>
            <ol className="grid list-none gap-1.5 sm:grid-cols-2">
                {question.options.map((option, index) => (
                    <li
                        key={index}
                        className={cn(
                            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                            index === question.correctIndex && 'answer-key border-success/50 bg-success/10',
                        )}
                    >
                        <span className="font-semibold">{LETTERS[index]})</span>
                        <span className="min-w-0 flex-1">{option}</span>
                        {index === question.correctIndex && (
                            <Check aria-label={t('assessments.question.correct')} className="answer-key size-4 shrink-0 text-success" />
                        )}
                    </li>
                ))}
            </ol>
            {question.explanation && (
                <p className="answer-key text-xs text-muted-foreground">
                    {t('assessments.question.explanation')}: {question.explanation}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </article>
    );
}
