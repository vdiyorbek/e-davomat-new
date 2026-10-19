
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Pencil, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPatch } from '@/lib/auth-session';

interface TextbookTopic {
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
}

const reviewLabels: Record<TextbookTopic['reviewStatus'], string> = {
    PENDING_REVIEW: 'Tekshirilmagan',
    APPROVED: 'Tasdiqlangan',
    REJECTED: 'Rad etilgan',
};

function parsePage(value: string): number | null {
    if (!value.trim()) return null;

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number < 1) {
        throw new Error(
            'Sahifa raqami musbat butun son bo‘lishi kerak.',
        );
    }

    return number;
}

export function TextbookTopicRow({
    topic,
    onUpdated,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [title, setTitle] = useState(topic.title);
    const [chapterTitle, setChapterTitle] = useState(
        topic.chapterTitle ?? '',
    );
    const [pageStart, setPageStart] = useState(
        topic.pageStart?.toString() ?? '',
    );
    const [pageEnd, setPageEnd] = useState(
        topic.pageEnd?.toString() ?? '',
    );

    function startEditing() {
        setTitle(topic.title);
        setChapterTitle(topic.chapterTitle ?? '');
        setPageStart(topic.pageStart?.toString() ?? '');
        setPageEnd(topic.pageEnd?.toString() ?? '');
        setError('');
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setError('');
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        setError('');

        try {
            const cleanTitle = title.trim();
            const cleanChapter = chapterTitle.trim();

            if (!cleanTitle || cleanTitle.length > 255) {
                throw new Error(
                    'Mavzu nomi 1–255 belgidan iborat bo‘lishi kerak.',
                );
            }

            const start = parsePage(pageStart);
            const end = parsePage(pageEnd);

            if (start !== null && end !== null && start > end) {
                throw new Error(
                    'Boshlanish sahifasi tugash sahifasidan katta.',
                );
            }

            setBusy(true);

            await authorizedPatch(
                `/textbooks/topics/${topic.id}`,
                {
                    title: cleanTitle,
                    chapterTitle: cleanChapter || null,
                    pageStart: start,
                    pageEnd: end,
                },
            );

            setEditing(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Mavzuni saqlashda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleApprove() {
        if (busy || editing) return;

        const confirmed = window.confirm(
            `"${topic.title}" mavzusini tasdiqlaysizmi?`,
        );

        if (!confirmed) return;

        setBusy(true);
        setError('');

        try {
            await authorizedPatch(
                `/textbooks/topics/${topic.id}/approve`,
                {},
            );

            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Mavzuni tasdiqlab bo‘lmadi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <tr className="border-t border-border">
                <td className="px-4 py-3 tabular-nums">
                    {topic.orderIndex}
                </td>

                <td className="px-4 py-3">
                    {topic.chapterTitle ?? '—'}
                </td>

                <td className="px-4 py-3 font-medium">
                    {topic.title}
                </td>

                <td className="px-4 py-3 tabular-nums">
                    {topic.pageStart === null
                        ? '—'
                        : topic.pageEnd === null
                            ? String(topic.pageStart)
                            : `${topic.pageStart}–${topic.pageEnd}`}
                </td>

                <td className="px-4 py-3">
                    <span
                        className={
                            topic.reviewStatus === 'APPROVED'
                                ? 'font-medium text-green-600'
                                : 'text-muted-foreground'
                        }
                    >
                        {reviewLabels[topic.reviewStatus]}
                    </span>
                </td>

                <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={
                                editing ? cancelEditing : startEditing
                            }
                        >
                            <Pencil className="size-4" />
                            {editing ? 'Bekor qilish' : 'Tahrirlash'}
                        </Button>

                        {topic.reviewStatus !== 'APPROVED' && (
                            <Button
                                type="button"
                                size="sm"
                                disabled={busy || editing}
                                onClick={() => void handleApprove()}
                            >
                                <Check className="size-4" />
                                Tasdiqlash
                            </Button>
                        )}
                    </div>

                    {!editing && error && (
                        <p
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                </td>
            </tr>

            {editing && (
                <tr className="border-t border-border bg-muted/30">
                    <td colSpan={6} className="p-4">
                        <form
                            onSubmit={(event) => void handleSave(event)}
                            className="space-y-4"
                        >
                            <h3 className="font-semibold">
                                {topic.orderIndex}-mavzuni tahrirlash
                            </h3>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-medium">
                                    Mavzu nomi
                                    <Input
                                        className="mt-2"
                                        value={title}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                        maxLength={255}
                                        disabled={busy}
                                        required
                                    />
                                </label>

                                <label className="text-sm font-medium">
                                    Bob nomi
                                    <Input
                                        className="mt-2"
                                        value={chapterTitle}
                                        onChange={(event) =>
                                            setChapterTitle(event.target.value)
                                        }
                                        maxLength={255}
                                        disabled={busy}
                                    />
                                </label>

                                <label className="text-sm font-medium">
                                    Boshlanish sahifasi
                                    <Input
                                        className="mt-2"
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={pageStart}
                                        onChange={(event) =>
                                            setPageStart(event.target.value)
                                        }
                                        disabled={busy}
                                    />
                                </label>

                                <label className="text-sm font-medium">
                                    Tugash sahifasi
                                    <Input
                                        className="mt-2"
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={pageEnd}
                                        onChange={(event) =>
                                            setPageEnd(event.target.value)
                                        }
                                        disabled={busy}
                                    />
                                </label>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Tasdiqlangan mavzu o‘zgartirilsa,
                                qayta tekshirish holatiga o‘tadi.
                            </p>

                            {error && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {error}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" disabled={busy}>
                                    <Check className="size-4" />
                                    {busy ? 'Saqlanmoqda…' : 'Saqlash'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={busy}
                                >
                                    <X className="size-4" />
                                    Bekor qilish
                                </Button>
                            </div>
                        </form>
                    </td>
                </tr>
            )}
        </>
    );
}
