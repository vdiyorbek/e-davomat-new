import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authorizedGet, authorizedPost } from '@/lib/auth-session';
import { addDays, formatDate, formatDateTime, todayInTashkent } from '@/lib/date';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/common/DatePicker';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface BackfillDay {
    date: string;
    fetched: number;
    inserted: number;
    duplicates: number;
    photosQueued: number;
    error: string | null;
}

interface BackfillStatus {
    state: 'running' | 'done' | 'failed';
    from: string;
    to: string;
    currentDate: string | null;
    days: BackfillDay[];
    updatedAt: string;
}

/**
 * Push terminalning xotirasidan sana oralig‘ida eventlarni qayta olish (faqat super administrator).
 * Push navbatidan tushib qolgan yoki bazadan o‘chirilgan kunlarni tiklaydi.
 */
export function TerminalEventBackfill({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const today = todayInTashkent();
    const [from, setFrom] = useState(addDays(today, -7));
    const [to, setTo] = useState(today);
    const [status, setStatus] = useState<BackfillStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const running = status?.state === 'running';

    // Boshlang‘ich holat; jarayon ketayotgan bo‘lsa har 3 soniyada yangilanadi.
    useEffect(() => {
        let active = true;
        let timer: number | undefined;

        async function load() {
            try {
                const next = await authorizedGet<BackfillStatus | null>(`/terminals/${terminalId}/events-backfill`);
                if (!active) return;
                setStatus(next);
                if (next?.state === 'running') timer = window.setTimeout(() => void load(), 3000);
            } catch {
                if (active) timer = window.setTimeout(() => void load(), 6000);
            }
        }

        void load();
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [terminalId, busy]);

    async function start() {
        if (busy || running) return;
        if (!(await confirm({ title: t('terminals.backfill.confirm', { from: formatDate(from), to: formatDate(to) }) }))) return;
        setBusy(true);
        setError('');
        try {
            setStatus(await authorizedPost<BackfillStatus>(`/terminals/${terminalId}/events-backfill`, { from, to }));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.backfill.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section aria-labelledby={`backfill-${terminalId}`} className="space-y-3 rounded-xl border p-4">
            {dialog}
            <div className="flex items-center gap-2">
                <History aria-hidden="true" className="size-4 text-primary" />
                <h3 id={`backfill-${terminalId}`} className="font-heading text-sm font-bold">
                    {t('terminals.backfill.title')}
                </h3>
            </div>
            <p className="text-xs text-muted-foreground">{t('terminals.backfill.description')}</p>

            <div className="flex flex-wrap items-end gap-2">
                <Label className="space-y-1 text-xs text-muted-foreground">
                    {t('terminals.backfill.from')}
                    <DatePicker value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="h-9 w-auto" />
                </Label>
                <Label className="space-y-1 text-xs text-muted-foreground">
                    {t('terminals.backfill.to')}
                    <DatePicker value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} className="h-9 w-auto" />
                </Label>
                <Button type="button" size="sm" onClick={() => void start()} disabled={busy || running || !from || !to || from > to}>
                    {running ? t('terminals.backfill.running') : t('terminals.backfill.start')}
                </Button>
            </div>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {status && (
                <div className="space-y-2" aria-live="polite">
                    <p className="text-xs text-muted-foreground">
                        {running
                            ? t('terminals.backfill.progress', { date: status.currentDate ? formatDate(status.currentDate) : '…' })
                            : t(`terminals.backfill.state.${status.state}`, { time: formatDateTime(status.updatedAt) })}
                    </p>
                    {status.days.length > 0 && (
                        <Table className="w-full text-xs tabular-nums">
                            <TableHeader>
                                <TableRow className="text-left text-muted-foreground">
                                    <TableHead className="py-1 font-medium">{t('terminals.backfill.columns.date')}</TableHead>
                                    <TableHead className="py-1 text-right font-medium">{t('terminals.backfill.columns.fetched')}</TableHead>
                                    <TableHead className="py-1 text-right font-medium">{t('terminals.backfill.columns.inserted')}</TableHead>
                                    <TableHead className="py-1 text-right font-medium">{t('terminals.backfill.columns.duplicates')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {status.days.map((day) => (
                                    <TableRow key={day.date} className="border-t">
                                        <TableCell className="py-1">{formatDate(day.date)}</TableCell>
                                        {day.error ? (
                                            <TableCell colSpan={3} className="py-1 text-destructive">
                                                {day.error}
                                            </TableCell>
                                        ) : (
                                            <>
                                                <TableCell className="py-1 text-right">{day.fetched}</TableCell>
                                                <TableCell className="py-1 text-right font-semibold">{day.inserted}</TableCell>
                                                <TableCell className="py-1 text-right text-muted-foreground">{day.duplicates}</TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            )}
        </section>
    );
}
