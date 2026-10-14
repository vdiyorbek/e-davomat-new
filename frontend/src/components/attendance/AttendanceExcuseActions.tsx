
import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { FileText, Ban, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    authorizedGet,
    authorizedPatch,
} from '@/lib/auth-session';

interface Props {
    excuseId: number;
    status: 'ACTIVE' | 'CANCELLED';
    onChanged: () => void;
}

function PdfPreview({ excuseId }: { excuseId: number }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        let objectUrl: string | null = null;

        setUrl('');
        setError('');

        void authorizedGet<Blob>(
            `/attendance-excuses/${excuseId}/pdf`,
            controller.signal,
            'blob',
        )
            .then((blob) => {
                if (controller.signal.aborted) return;

                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : 'PDF hujjatni ochib bo‘lmadi.',
                );
            });

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [open, excuseId]);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <FileText className="size-4" />
                    PDF
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />

                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 flex h-[90dvh] w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-background p-4 shadow-xl outline-none"
                >
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <Dialog.Title className="font-bold">
                                Asoslovchi PDF — ariza №{excuseId}
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-muted-foreground">
                                Hujjat faqat ruxsat berilgan foydalanuvchiga ko‘rsatiladi.
                            </Dialog.Description>
                        </div>

                        <Dialog.Close asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Yopish"
                            >
                                <X className="size-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : url ? (
                        <iframe
                            src={url}
                            title={`Ariza ${excuseId}`}
                            className="min-h-0 w-full flex-1 rounded-xl border"
                        />
                    ) : (
                        <p role="status" className="text-sm text-muted-foreground">
                            PDF yuklanmoqda…
                        </p>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function CancelExcuse({
    excuseId,
    onChanged,
}: {
    excuseId: number;
    onChanged: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function submit() {
        const cancellationReason = reason.trim();

        if (
            cancellationReason.length < 5 ||
            cancellationReason.length > 500 ||
            saving
        ) {
            return;
        }

        setSaving(true);
        setError('');

        try {
            await authorizedPatch(
                `/attendance-excuses/${excuseId}/cancel`,
                { cancellationReason },
            );

            setOpen(false);
            setReason('');
            onChanged();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Arizani bekor qilib bo‘lmadi.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(next) => {
                if (!saving) setOpen(next);
            }}
        >
            <Dialog.Trigger asChild>
                <Button type="button" variant="destructive" size="sm">
                    <Ban className="size-4" />
                    Bekor qilish
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />

                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background p-6 shadow-xl outline-none"
                >
                    <Dialog.Title className="text-lg font-bold">
                        Arizani bekor qilish
                    </Dialog.Title>

                    <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                        №{excuseId} ariza bekor qilinadi. Bekor qilish sababi
                        tarixda saqlanadi.
                    </Dialog.Description>

                    <form
                        className="mt-5 space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submit();
                        }}
                    >
                        <div className="space-y-2">
                            <label
                                htmlFor={`cancel-${excuseId}`}
                                className="text-sm font-semibold"
                            >
                                Bekor qilish sababi *
                            </label>

                            <textarea
                                id={`cancel-${excuseId}`}
                                required
                                minLength={5}
                                maxLength={500}
                                rows={3}
                                value={reason}
                                disabled={saving}
                                onChange={(event) => setReason(event.target.value)}
                                className="w-full rounded-xl border border-input bg-background p-3 text-sm"
                                placeholder="Masalan: ariza xato sana bilan kiritilgan"
                            />
                        </div>

                        {error && (
                            <p role="alert" className="text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={saving}
                                onClick={() => setOpen(false)}
                            >
                                Ortga
                            </Button>

                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={saving || reason.trim().length < 5}
                            >
                                {saving ? 'Saqlanmoqda…' : 'Bekor qilishni tasdiqlash'}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export function AttendanceExcuseActions({
    excuseId,
    status,
    onChanged,
}: Props) {
    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <PdfPreview excuseId={excuseId} />

            {status === 'ACTIVE' && (
                <CancelExcuse
                    excuseId={excuseId}
                    onChanged={onChanged}
                />
            )}
        </div>
    );
}
