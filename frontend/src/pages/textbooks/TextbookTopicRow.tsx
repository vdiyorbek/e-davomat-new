import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, Pencil } from 'lucide-react';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authorizedPatch } from '@/lib/auth-session';

export interface TextbookTopic {
    id: number;
    orderIndex: number;
    chapterTitle: string | null;
    title: string;
    pageStart: number | null;
    pageEnd: number | null;
    reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

interface Props {
    topic: TextbookTopic;
    onUpdated: () => void;
    onOpenPage?: (page: number) => void;
}

const REVIEW_TONE = { PENDING_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;

function parsePage(value: string, message: string): number | null {
    if (!value.trim()) return null;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(message);
    return number;
}

/** Darslik mavzusi: ro‘yxat elementi, tahrirlash oynasi va tasdiqlash. */
export function TextbookTopicRow({
    topic,
    onUpdated,
    onOpenPage,
}: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { confirm, dialog } = useConfirm();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [title, setTitle] = useState(topic.title);
    const [chapterTitle, setChapterTitle] = useState(topic.chapterTitle ?? '');
    const [pageStart, setPageStart] = useState(topic.pageStart?.toString() ?? '');
    const [pageEnd, setPageEnd] = useState(topic.pageEnd?.toString() ?? '');

    function startEditing() {
        setTitle(topic.title);
        setChapterTitle(topic.chapterTitle ?? '');
        setPageStart(topic.pageStart?.toString() ?? '');
        setPageEnd(topic.pageEnd?.toString() ?? '');
        setError('');
        setEditing(true);
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        try {
            const cleanTitle = title.trim();
            if (!cleanTitle || cleanTitle.length > 255) throw new Error(t('textbooks.topics.errors.title'));
            const start = parsePage(pageStart, t('textbooks.topics.errors.page'));
            const end = parsePage(pageEnd, t('textbooks.topics.errors.page'));
            if (start !== null && end !== null && start > end) throw new Error(t('textbooks.topics.errors.range'));

            setBusy(true);
            await authorizedPatch(`/textbooks/topics/${topic.id}`, {
                title: cleanTitle,
                chapterTitle: chapterTitle.trim() || null,
                pageStart: start,
                pageEnd: end,
            });
            setEditing(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('textbooks.topics.errors.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    async function handleApprove() {
        if (busy || editing) return;
        const confirmed = await confirm({
            title: t('textbooks.topics.approveTitle'),
            description: t('textbooks.topics.approveConfirm', { title: topic.title }),
            confirmLabel: t('textbooks.topics.approve'),
        });
        if (!confirmed) return;

        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/textbooks/topics/${topic.id}/approve`, {});
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('textbooks.topics.errors.approveFailed'));
        } finally {
            setBusy(false);
        }
    }

    const pages =
        topic.pageStart === null ? '—' : topic.pageEnd === null ? String(topic.pageStart) : `${topic.pageStart}–${topic.pageEnd}`;

    return (
        <li className="flex min-w-0 flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-4 sm:px-5">
            {dialog}
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold tabular-nums">
                    {topic.orderIndex}
                </span>

                <div className="min-w-0 flex-1">
                    {topic.chapterTitle && (
                        <p className="mb-1 text-xs text-muted-foreground break-words">
                            {topic.chapterTitle}
                        </p>
                    )}

                    <p className="text-sm font-semibold leading-6 break-words">
                        {topic.title}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {t('textbooks.topics.pagesValue', { pages })}
                        </span>

                        {topic.pageStart !== null && onOpenPage && (
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => onOpenPage(topic.pageStart!)}
                            >
                                <BookOpen aria-hidden="true" />
                                {t('textbooks.topics.openInPdf')}
                            </Button>
                        )}
                    </div>

                    {!editing && error && (
                        <p role="alert" className="mt-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 lg:pl-0">
                <StatusBadge tone={REVIEW_TONE[topic.reviewStatus]}>
                    {t(`textbooks.topics.review.${topic.reviewStatus}`)}
                </StatusBadge>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={startEditing}
                >
                    <Pencil aria-hidden="true" />
                    {t('common.edit')}
                </Button>

                {topic.reviewStatus !== 'APPROVED' && (
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy || editing}
                        onClick={() => void handleApprove()}
                    >
                        <Check aria-hidden="true" />
                        {t('textbooks.topics.approve')}
                    </Button>
                )}
            </div>

            <Dialog open={editing} onOpenChange={(open) => !busy && setEditing(open)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('textbooks.topics.editTitle', { n: topic.orderIndex })}</DialogTitle>
                        <DialogDescription>{t('textbooks.topics.editHint')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
                        <Field htmlFor={`${id}-title`} label={t('textbooks.topics.title')} required>
                            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} disabled={busy} required />
                        </Field>
                        <Field htmlFor={`${id}-chapter`} label={t('textbooks.topics.chapter')}>
                            <Input id={`${id}-chapter`} value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} maxLength={255} disabled={busy} />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field htmlFor={`${id}-start`} label={t('textbooks.topics.pageStart')}>
                                <Input id={`${id}-start`} type="number" inputMode="numeric" min={1} step={1} value={pageStart} onChange={(e) => setPageStart(e.target.value)} disabled={busy} />
                            </Field>
                            <Field htmlFor={`${id}-end`} label={t('textbooks.topics.pageEnd')}>
                                <Input id={`${id}-end`} type="number" inputMode="numeric" min={1} step={1} value={pageEnd} onChange={(e) => setPageEnd(e.target.value)} disabled={busy} />
                            </Field>
                        </div>
                        {error && <ErrorState message={error} />}
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </li>
    );
}
