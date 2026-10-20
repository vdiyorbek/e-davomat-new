import { useEffect, useId, useState } from 'react';
import { Ban, Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { authorizedGet, authorizedPatch } from '@/lib/auth-session';

interface Props {
    excuseId: number;
    status: 'ACTIVE' | 'CANCELLED';
    onChanged: () => void;
}

function PdfPreview({ excuseId }: { excuseId: number }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;
        setUrl('');
        setError('');

        void authorizedGet<Blob>(`/attendance-excuses/${excuseId}/pdf`, controller.signal, 'blob')
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : t('excuses.pdf.failed'));
            });

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, excuseId, t]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <FileText aria-hidden="true" />
                    PDF
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[90svh] flex-col sm:max-w-5xl">
                <DialogHeader className="pr-8">
                    <DialogTitle>{t('excuses.pdf.title', { id: excuseId })}</DialogTitle>
                    <DialogDescription>{t('excuses.pdf.description')}</DialogDescription>
                </DialogHeader>
                {error ? (
                    <ErrorState message={error} />
                ) : url ? (
                    <>
                        <iframe src={url} title={t('excuses.pdf.frameTitle', { id: excuseId })} className="min-h-0 w-full flex-1 rounded-xl border bg-muted" />
                        <Button asChild variant="outline" className="w-full sm:w-fit sm:self-end">
                            <a href={url} download={`ariza-${excuseId}.pdf`}>
                                <Download aria-hidden="true" />
                                {t('excuses.pdf.download')}
                            </a>
                        </Button>
                    </>
                ) : (
                    <div role="status" className="flex-1">
                        <span className="sr-only">{t('common.loading')}</span>
                        <Skeleton className="h-full w-full rounded-xl" />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function CancelExcuse({ excuseId, onChanged }: { excuseId: number; onChanged: () => void }) {
    const { t } = useTranslation();
    const id = useId();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function submit() {
        const cancellationReason = reason.trim();
        if (cancellationReason.length < 5 || cancellationReason.length > 500 || saving) return;

        setSaving(true);
        setError('');
        try {
            await authorizedPatch(`/attendance-excuses/${excuseId}/cancel`, { cancellationReason });
            setOpen(false);
            setReason('');
            onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('excuses.cancel.failed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
            <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                    <Ban aria-hidden="true" />
                    {t('excuses.cancel.button')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('excuses.cancel.title')}</DialogTitle>
                    <DialogDescription>{t('excuses.cancel.description', { id: excuseId })}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <Field htmlFor={`${id}-reason`} label={t('excuses.cancel.reason')} hint={t('excuses.cancel.reasonHint')} required>
                        <Textarea
                            id={`${id}-reason`}
                            required
                            minLength={5}
                            maxLength={500}
                            rows={3}
                            value={reason}
                            disabled={saving}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={t('excuses.cancel.placeholder')}
                        />
                    </Field>
                    {error && <ErrorState message={error} />}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                            {t('common.back')}
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            className="bg-destructive text-white hover:bg-destructive/90"
                            disabled={saving || reason.trim().length < 5}
                        >
                            {saving ? t('common.saving') : t('excuses.cancel.confirm')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function AttendanceExcuseActions({ excuseId, status, onChanged }: Props) {
    return (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <PdfPreview excuseId={excuseId} />
            {status === 'ACTIVE' && <CancelExcuse excuseId={excuseId} onChanged={onChanged} />}
        </div>
    );
}
