import { useEffect, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authorizedGet } from '@/lib/auth-session';

interface Props {
    textbookId: number;
    title: string;
    page?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showTrigger?: boolean;
}

/**
 * PDF darslikni dialog ichida ko‘rsatadi. Telefon brauzerlari ko‘pincha
 * iframe ichida PDF ko‘rsatmaydi, shuning uchun «Yangi oynada ochish» va
 * «Yuklab olish» tugmalari ham bor.
 */
export function TextbookPdfViewer({ textbookId, title, page, open: controlledOpen, onOpenChange, showTrigger = true }: Props) {
    const { t } = useTranslation();
    const [internalOpen, setInternalOpen] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    const open = controlledOpen ?? internalOpen;

    function changeOpen(value: boolean) {
        if (controlledOpen === undefined) setInternalOpen(value);
        onOpenChange?.(value);
    }

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;

        async function loadPdf() {
            setLoading(true);
            setError('');
            setUrl(null);
            try {
                const blob = await authorizedGet<Blob>(`/textbooks/${textbookId}/pdf`, controller.signal, 'blob', 120000);
                if (controller.signal.aborted) return;
                if (blob.type && !blob.type.toLowerCase().includes('pdf')) throw new Error(t('textbooks.pdf.notPdf'));
                objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                setUrl(objectUrl);
            } catch (caught: unknown) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : t('textbooks.pdf.failed'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void loadPdf();
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, textbookId, attempt, t]);

    const validPage = typeof page === 'number' && Number.isSafeInteger(page) && page > 0;
    const pdfUrl = url ? `${url}#page=${validPage ? page : 1}&zoom=page-width` : null;
    const fileName = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'textbook'}.pdf`;

    return (
        <>
            {showTrigger && (
                <Button type="button" variant="outline" size="sm" onClick={() => changeOpen(true)}>
                    <Eye aria-hidden="true" />
                    {t('textbooks.pdf.view')}
                </Button>
            )}

            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-3 overflow-hidden sm:max-w-[1100px]">
                    <DialogHeader className="pr-8">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
                            <span className="truncate">{title}</span>
                        </DialogTitle>
                        <DialogDescription>{validPage ? t('textbooks.pdf.pageN', { page }) : t('textbooks.pdf.description')}</DialogDescription>
                    </DialogHeader>

                    {pdfUrl && (
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink aria-hidden="true" />
                                    {t('textbooks.pdf.openTab')}
                                </a>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                                <a href={url ?? undefined} download={fileName}>
                                    <Download aria-hidden="true" />
                                    {t('textbooks.pdf.download')}
                                </a>
                            </Button>
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
                        {loading ? (
                            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
                                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                {t('textbooks.pdf.loading')}
                            </div>
                        ) : error ? (
                            <div className="p-4">
                                <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />
                            </div>
                        ) : pdfUrl ? (
                            <iframe title={t('textbooks.pdf.frameTitle', { title })} src={pdfUrl} className="h-full w-full border-0" />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
