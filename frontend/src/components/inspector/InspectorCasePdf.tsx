import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { authorizedGet } from '@/lib/auth-session';

interface Props {
    caseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** O‘rganish hisobotini (server yaratgan PDF) ko‘rsatadi va yuklab olish imkonini beradi. */
export function InspectorCasePdf({ caseId, open, onOpenChange }: Props) {
    const { t } = useTranslation();
    const [result, setResult] = useState<{ caseId: number; url: string; error: string } | null>(null);
    const current = open && result?.caseId === caseId ? result : null;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;

        void authorizedGet<Blob>(`/inspectors/me/cases/${caseId}/pdf`, controller.signal, 'blob')
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setResult({ caseId, url: objectUrl, error: '' });
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setResult({
                    caseId,
                    url: '',
                    error: err instanceof Error ? err.message : t('inspectors.cases.pdf.failed'),
                });
            });

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, caseId, t]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);
                if (!next) setResult(null);
            }}
        >
            <DialogContent className="flex h-[90svh] flex-col sm:max-w-4xl">
                <DialogHeader className="pr-8">
                    <DialogTitle>{t('inspectors.cases.pdf.title', { id: caseId })}</DialogTitle>
                    <DialogDescription>{t('inspectors.cases.pdf.description')}</DialogDescription>
                </DialogHeader>
                {current?.error ? (
                    <ErrorState message={current.error} />
                ) : current?.url ? (
                    <>
                        <iframe
                            src={current.url}
                            title={t('inspectors.cases.pdf.title', { id: caseId })}
                            className="min-h-0 w-full flex-1 rounded-xl border bg-muted"
                        />
                        <Button asChild variant="outline" className="w-full sm:w-fit sm:self-end">
                            <a href={current.url} download={`hisobot-${caseId}.pdf`}>
                                <Download aria-hidden="true" />
                                {t('inspectors.cases.pdf.download')}
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

export function CasePdfButton({ onClick }: { onClick: () => void }) {
    return (
        <Button type="button" variant="outline" size="sm" onClick={onClick}>
            <FileText aria-hidden="true" />
            PDF
        </Button>
    );
}
