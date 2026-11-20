import { useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authorizedPost } from '@/lib/auth-session';

interface Result {
    total: number;
    ok: number;
    failed: number;
    items: { id: number; name: string; ok: boolean; message: string; beforeSeconds: number | null }[];
}

/** Barcha faol terminallar soatini server (Toshkent vaqti) bilan bir tugmada moslaydi. */
export function TerminalTimeSyncButton({ onDone }: { onDone?: () => void }) {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);

    async function run() {
        const ok = await confirm({
            title: t('terminals.timeSync.confirmTitle'),
            description: t('terminals.timeSync.confirmDescription'),
            confirmLabel: t('terminals.timeSync.confirm'),
        });
        if (!ok) return;
        setBusy(true);
        setError('');
        setResult(null);
        setOpen(true);
        try {
            setResult(await authorizedPost<Result>('/terminals/bulk/time-sync', {}, 10 * 60_000));
            onDone?.();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.timeSync.failed'));
        } finally {
            setBusy(false);
        }
    }

    function drift(seconds: number | null) {
        if (seconds === null) return '—';
        const abs = Math.abs(seconds);
        return abs < 60 ? t('terminals.timeSync.seconds', { count: abs }) : t('terminals.timeSync.minutes', { count: Math.round(abs / 60) });
    }

    return (
        <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Clock3 aria-hidden="true" />}
                {t('terminals.timeSync.button')}
            </Button>
            {dialog}
            <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('terminals.timeSync.resultTitle')}</DialogTitle>
                        <DialogDescription>
                            {result
                                ? t('terminals.timeSync.summary', { ok: result.ok, failed: result.failed, total: result.total })
                                : t('terminals.timeSync.running')}
                        </DialogDescription>
                    </DialogHeader>
                    {busy && (
                        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                            {t('terminals.timeSync.running')}
                        </div>
                    )}
                    {error && <ErrorState message={error} />}
                    {result && (
                        <ul className="divide-y rounded-xl border text-sm">
                            {result.items.map((item) => (
                                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="font-medium [overflow-wrap:anywhere]">{item.name}</p>
                                        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                            {item.ok
                                                ? t('terminals.timeSync.wasOff', { value: drift(item.beforeSeconds) })
                                                : item.message}
                                        </p>
                                    </div>
                                    <StatusBadge tone={item.ok ? 'success' : 'danger'}>
                                        {item.ok ? t('terminals.timeSync.ok') : t('terminals.timeSync.fail')}
                                    </StatusBadge>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
