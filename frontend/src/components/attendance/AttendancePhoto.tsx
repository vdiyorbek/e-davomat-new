import { useEffect, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authorizedGet } from '@/lib/auth-session';

interface AttendancePhotoProps {
    url: string;
    alt: string;
}

export function AttendancePhoto({ url, alt }: AttendancePhotoProps) {
    const { t } = useTranslation();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ source: '', objectUrl: '', error: '' });

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | null = null;
        setState({ source: url, objectUrl: '', error: '' });

        async function load() {
            try {
                if (!/^\/api\/daily-attendance\/[1-9]\d*\/photos\/(in|out)$/.test(url)) {
                    throw new Error('invalid url');
                }
                const blob = await authorizedGet<Blob>(url.slice('/api'.length), controller.signal, 'blob');
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setState({ source: url, objectUrl, error: '' });
            } catch {
                if (controller.signal.aborted) return;
                setState({ source: url, objectUrl: '', error: 'photo.loadFailed' });
            }
        }

        void load();
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url, attempt]);

    const current = state.source === url;
    const error = current ? state.error : '';
    const objectUrl = current ? state.objectUrl : '';

    if (error) {
        return (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-muted p-3 text-center">
                <ImageOff aria-hidden="true" className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t(error)}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                    <RotateCw aria-hidden="true" />
                    {t('common.retry')}
                </Button>
            </div>
        );
    }

    if (!objectUrl) {
        return (
            <div role="status" className="relative">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <span className="sr-only">{t('photo.loading')}</span>
            </div>
        );
    }

    return (
        <img
            src={objectUrl}
            alt={alt}
            className="aspect-[4/3] w-full rounded-xl bg-muted object-contain"
            onError={() => setState({ source: url, objectUrl: '', error: 'photo.loadFailed' })}
        />
    );
}
