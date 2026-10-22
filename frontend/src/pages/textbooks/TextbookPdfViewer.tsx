
import { useEffect, useState } from 'react';
import { Eye, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

import { authorizedGet } from '@/lib/auth-session';

interface Props {
    textbookId: number;
    title: string;
    page?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showTrigger?: boolean;
}

export function TextbookPdfViewer({
    textbookId,
    title,
    page,
    open: controlledOpen,
    onOpenChange,
    showTrigger = true,
}: Props) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const open = controlledOpen ?? internalOpen;

    function changeOpen(value: boolean) {
        if (controlledOpen === undefined) {
            setInternalOpen(value);
        }
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
                const blob = await authorizedGet<Blob>(
                    `/textbooks/${textbookId}/pdf`,
                    controller.signal,
                    'blob',
                    120000,
                );

                if (controller.signal.aborted) return;

                if (
                    blob.type &&
                    !blob.type.toLowerCase().includes('pdf')
                ) {
                    throw new Error(
                        'Server PDF formatida javob qaytarmadi.',
                    );
                }

                objectUrl = URL.createObjectURL(
                    new Blob([blob], {
                        type: 'application/pdf',
                    }),
                );

                setUrl(objectUrl);
            } catch (caught: unknown) {
                if (controller.signal.aborted) return;

                setError(
                    caught instanceof Error
                        ? caught.message
                        : 'PDF faylni ochib bo‘lmadi.',
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadPdf();

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [open, textbookId]);

    const validPage =
        page !== null &&
        page !== undefined &&
        Number.isSafeInteger(page) &&
        page > 0;

    const pdfUrl = url
        ? `${url}#page=${validPage ? page : 1}&zoom=page-width`
        : null;

    return (
        <>
            {showTrigger && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => changeOpen(true)}
                >
                    <Eye aria-hidden="true" />
                    Kitobni ko‘rish
                </Button>
            )}

            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-3 overflow-hidden sm:max-w-[1100px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText aria-hidden="true" />
                            {title}
                        </DialogTitle>

                        <DialogDescription>
                            {validPage
                                ? `Darslikning ${page}-sahifasi`
                                : 'Yuklangan darslikning PDF ko‘rinishi'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                PDF yuklanmoqda...
                            </div>
                        ) : error ? (
                            <div
                                role="alert"
                                className="p-5 text-sm text-destructive"
                            >
                                {error}
                            </div>
                        ) : pdfUrl ? (
                            <iframe
                                title={`${title} PDF`}
                                src={pdfUrl}
                                className="h-full w-full border-0"
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
