import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { authorizedGet } from '@/lib/auth-session';

export function InspectorTalkPdf({ talkId }: { talkId: number }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<{
        talkId: number;
        url: string;
        error: string;
    } | null>(null);
    const current = open && result?.talkId === talkId ? result : null;
    const url = current?.url ?? '';
    const error = current?.error ?? '';
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;

        void authorizedGet<Blob>(`/inspectors/talks/${talkId}/pdf`, controller.signal, 'blob')
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setResult({ talkId, url: objectUrl, error: '' });
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setResult({
                    talkId,
                    url: '',
                    error: err instanceof Error ? err.message : t('inspectors.talks.pdf.failed'),
                });
            });

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, talkId, t]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setResult(null);
            }}
        >
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <FileText aria-hidden="true" />
                    PDF
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[90svh] flex-col sm:max-w-5xl">
                <DialogHeader className="pr-8">
                    <DialogTitle>{t('inspectors.talks.pdf.title')}</DialogTitle>
                    <DialogDescription>{t('inspectors.talks.pdf.description')}</DialogDescription>
                </DialogHeader>
                {error ? (
                    <ErrorState message={error} />
                ) : url ? (
                    <>
                        <iframe
                            src={url}
                            title={t('inspectors.talks.pdf.frameTitle')}
                            className="min-h-0 w-full flex-1 rounded-xl border bg-muted"
                        />
                        <Button asChild variant="outline" className="w-full sm:w-fit sm:self-end">
                            <a href={url} download={`suhbat-${talkId}.pdf`}>
                                <Download aria-hidden="true" />
                                {t('inspectors.talks.pdf.download')}
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