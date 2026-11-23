import { useEffect, useId, useState } from 'react';
import { Ban, Check, Download, FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
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
    status: 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'REJECTED';
    onChanged: () => void;
}

export function PdfPreview({ excuseId, pdfPath }: { excuseId: number; /** Standart: /attendance-excuses/:id/pdf */ pdfPath?: string }) {
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

        void authorizedGet<Blob>(pdfPath ?? `/attendance-excuses/${excuseId}/pdf`, controller.signal, 'blob')
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
    }, [open, excuseId, pdfPath, t]);

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

function ApproveExcuse({ excuseId, onChanged }: { excuseId: number; onChanged: () => void }) {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function approve() {
        if (busy) return;
        const ok = await confirm({
            title: t('excuses.approve.title'),
            description: t('excuses.approve.description', { id: excuseId }),
            confirmLabel: t('excuses.approve.confirm'),
        });
        if (!ok) return;
        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/attendance-excuses/${excuseId}/approve`, {});
            onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('excuses.approve.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {dialog}
            <Button type="button" size="sm" disabled={busy} onClick={() => void approve()}>
                <Check aria-hidden="true" />
                {t('excuses.approve.button')}
            </Button>
            {error && (
                <p role="alert" className="basis-full text-xs text-destructive">
                    {error}
                </p>
            )}
        </>
    );
}

function RejectExcuse({ excuseId, onChanged }: { excuseId: number; onChanged: () => void }) {
    const { t } = useTranslation();
    const id = useId();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function submit() {
        const rejectionReason = reason.trim();
        if (rejectionReason.length < 5 || rejectionReason.length > 500 || saving) return;

        setSaving(true);
        setError('');
        try {
            await authorizedPatch(`/attendance-excuses/${excuseId}/reject`, { rejectionReason });
            setOpen(false);
            setReason('');
            onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('excuses.reject.failed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
            <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                    <X aria-hidden="true" />
                    {t('excuses.reject.button')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('excuses.reject.title')}</DialogTitle>
                    <DialogDescription>{t('excuses.reject.description', { id: excuseId })}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <Field htmlFor={`${id}-reason`} label={t('excuses.reject.reason')} hint={t('excuses.reject.reasonHint')} required>
                        <Textarea
                            id={`${id}-reason`}
                            required
                            minLength={5}
                            maxLength={500}
                            rows={3}
                            value={reason}
                            disabled={saving}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={t('excuses.reject.placeholder')}
                        />
                    </Field>
                    {error && <ErrorState message={error} />}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                            {t('common.back')}
                        </Button>
                        <Button type="submit" variant="destructive" disabled={saving || reason.trim().length < 5}>
                            {saving ? t('common.saving') : t('excuses.reject.confirm')}
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
            {status === 'PENDING' && (
                <>
                    <ApproveExcuse excuseId={excuseId} onChanged={onChanged} />
                    <RejectExcuse excuseId={excuseId} onChanged={onChanged} />
                </>
            )}
            {status === 'ACTIVE' && <CancelExcuse excuseId={excuseId} onChanged={onChanged} />}
        </div>
    );
}
