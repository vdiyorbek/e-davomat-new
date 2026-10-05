import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { authorizedGet } from '@/lib/auth-session';

interface AttendancePhotoProps {
    url: string;
    alt: string;
}

export function AttendancePhoto({
    url,
    alt,
}: AttendancePhotoProps) {
    const [attempt, setAttempt] = useState(0);

    const [state, setState] = useState({
        source: '',
        objectUrl: '',
        error: '',
    });

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | null = null;

        setState({
            source: url,
            objectUrl: '',
            error: '',
        });

        async function load() {
            try {
                if (
                    !/^\/api\/daily-attendance\/[1-9]\d*\/photos\/(in|out)$/.test(url)
                ) {
                    throw new Error('Rasm manzili noto‘g‘ri.');
                }

                const path = url.slice('/api'.length);

                const blob = await authorizedGet<Blob>(
                    path,
                    controller.signal,
                    'blob',
                );

                if (controller.signal.aborted) return;

                objectUrl = URL.createObjectURL(blob);

                setState({
                    source: url,
                    objectUrl,
                    error: '',
                });
            } catch {
                if (controller.signal.aborted) return;

                setState({
                    source: url,
                    objectUrl: '',
                    error: 'Rasmni yuklab bo‘lmadi.',
                });
            }
        }

        void load();

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [url, attempt]);

    const current = state.source === url;
    const error = current ? state.error : '';
    const objectUrl = current ? state.objectUrl : '';

    if (error) {
        return (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">
                    {error}
                </p>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttempt((value) => value + 1)}
                >
                    Qayta urinish
                </Button>
            </div>
        );
    }

    if (!objectUrl) {
        return (
            <div
                role="status"
                className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground"
            >
                Rasm yuklanmoqda…
            </div>
        );
    }

    return (
        <img
            src={objectUrl}
            alt={alt}
            className="aspect-[4/3] w-full rounded-xl bg-muted object-contain"
            onError={() => {
                setState({
                    source: url,
                    objectUrl: '',
                    error: 'Rasmni ko‘rsatib bo‘lmadi.',
                });
            }}
        />
    );
}