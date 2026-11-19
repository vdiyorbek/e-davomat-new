import { useEffect, useState } from 'react';
import { Pause, Play, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authorizedGet } from '@/lib/auth-session';
import type { LiveTerminal } from '@/types/live';

const FRAME_INTERVAL_MS = 350;

/**
 * Terminal kamerasi. Brauzer RTSP'ni ko‘rsata olmaydi, shuning uchun
 * backend orqali JPEG kadrlar ketma-ket olinadi (~3 kadr/s).
 * Sahifa yashirin bo‘lsa yoki pauza bosilsa so‘rov yuborilmaydi.
 */
export function TerminalCamera({ terminal }: { terminal: LiveTerminal }) {
    const { t } = useTranslation();
    const [frame, setFrame] = useState('');
    const [error, setError] = useState('');
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;

        const controller = new AbortController();
        let current = '';
        let timer: ReturnType<typeof setTimeout> | undefined;

        async function tick() {
            if (controller.signal.aborted) return;
            if (document.visibilityState === 'hidden') {
                timer = setTimeout(() => void tick(), 1000);
                return;
            }

            const startedAt = Date.now();
            try {
                const blob = await authorizedGet<Blob>(`/live/terminals/${terminal.id}/snapshot`, controller.signal, 'blob', 8000);
                if (controller.signal.aborted) return;
                const next = URL.createObjectURL(blob);
                if (current) URL.revokeObjectURL(current);
                current = next;
                setFrame(next);
                setError('');
                timer = setTimeout(() => void tick(), Math.max(0, FRAME_INTERVAL_MS - (Date.now() - startedAt)));
            } catch {
                if (controller.signal.aborted) return;
                // Blob javobda server matni o‘qilmaydi — umumiy tushunarli xabar.
                setError(t('live.cameraFailed'));
                // Terminal javob bermasa, uni so‘rovlar bilan bosmaymiz.
                timer = setTimeout(() => void tick(), 5000);
            }
        }

        void tick();

        return () => {
            controller.abort();
            clearTimeout(timer);
            if (current) URL.revokeObjectURL(current);
        };
    }, [terminal.id, paused, t]);

    return (
        <figure className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-video bg-black">
                {frame && !paused ? (
                    <img src={frame} alt={t('live.cameraOf', { name: terminal.name })} className="size-full object-contain" />
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/70">
                        <VideoOff aria-hidden="true" className="size-6" />
                        {paused ? t('live.paused') : error || t('live.connecting')}
                    </div>
                )}
                {!paused && frame && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-red-500" />
                        LIVE
                    </span>
                )}
                {error && frame && !paused && (
                    <span role="status" className="absolute right-2 bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                        {error}
                    </span>
                )}
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{terminal.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {terminal.direction === 'IN' ? t('live.directionIn') : t('live.directionOut')}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={paused ? t('live.resume') : t('live.pause')}
                    onClick={() => setPaused((value) => !value)}
                >
                    {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                </Button>
            </figcaption>
        </figure>
    );
}
