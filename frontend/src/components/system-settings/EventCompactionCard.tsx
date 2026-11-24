import { useState } from 'react';
import { Eraser, Loader2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedPost } from '@/lib/auth-session';
import { formatDate, formatDateTime, formatNumber } from '@/lib/date';

interface Status {
    enabled: boolean;
    keepDays: number;
    cutoffDay: string;
    cursorDay: string | null;
    running: boolean;
}

interface Run {
    id: number;
    trigger: 'SCHEDULED' | 'MANUAL';
    status: 'RUNNING' | 'DONE' | 'PARTIAL' | 'FAILED';
    startedAt: string;
    finishedAt: string | null;
    deletedRows: number;
    deletedFiles: number;
    throughDay: string | null;
    keepDays: number;
    error: string | null;
    startedBy: string | null;
}

interface Preview {
    sampleDay: string;
    sampleSchools: number;
    sampleEvents: number;
    sampleRemovable: number;
    removablePercent: number | null;
}

const TONE: Record<Run['status'], StatusTone> = { RUNNING: 'info', DONE: 'success', PARTIAL: 'warning', FAILED: 'danger' };

/** Eski eventlarni tozalash: faqat har bir shaxsning kunlik birinchi kirishi va oxirgi chiqishi qoladi. */
export function EventCompactionCard() {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const status = useApiQuery<Status>('/event-compaction/status');
    const history = useApiQuery<Run[]>('/event-compaction/history');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState<'preview' | 'run' | null>(null);
    const [error, setError] = useState('');

    const running = status.data?.running === true || history.data?.[0]?.status === 'RUNNING';
    // Ketayotgan bo‘lsa, jarayon 5 soniyada yangilanadi.
    useInterval(
        () => {
            status.retry();
            history.retry();
        },
        running ? 5000 : null,
    );

    async function runPreview() {
        setBusy('preview');
        setError('');
        try {
            setPreview(await authorizedPost<Preview>('/event-compaction/preview', {}, 120_000));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('systemSettings.compaction.failed'));
        } finally {
            setBusy(null);
        }
    }

    async function runNow() {
        if (
            !(await confirm({
                title: t('systemSettings.compaction.confirmTitle'),
                description: t('systemSettings.compaction.confirmText', { days: status.data?.keepDays ?? 30 }),
                confirmLabel: t('systemSettings.compaction.runNow'),
                destructive: true,
            }))
        ) {
            return;
        }
        setBusy('run');
        setError('');
        try {
            await authorizedPost('/event-compaction/run', {});
            status.retry();
            history.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('systemSettings.compaction.failed'));
        } finally {
            setBusy(null);
        }
    }

    return (
        <section aria-labelledby="compaction-title" className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            {dialog}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="compaction-title" className="font-heading text-base font-bold">
                        {t('systemSettings.compaction.title')}
                    </h2>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{t('systemSettings.compaction.description')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void runPreview()}>
                        {busy === 'preview' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Eraser aria-hidden="true" />}
                        {t('systemSettings.compaction.preview')}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy !== null || !status.data?.enabled || running} onClick={() => void runNow()}>
                        {running || busy === 'run' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
                        {t('systemSettings.compaction.runNow')}
                    </Button>
                </div>
            </div>

            {status.data && (
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('systemSettings.compaction.state')}</dt>
                        <dd className="mt-1">
                            <StatusBadge tone={status.data.enabled ? 'success' : 'neutral'}>
                                {status.data.enabled ? t('systemSettings.compaction.on') : t('systemSettings.compaction.off')}
                            </StatusBadge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('systemSettings.compaction.schedule')}</dt>
                        <dd className="mt-1 font-medium">{t('systemSettings.compaction.weekly')}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('systemSettings.compaction.cutoff')}</dt>
                        <dd className="mt-1 font-medium tabular-nums">{t('systemSettings.compaction.cutoffValue', { date: formatDate(status.data.cutoffDay), days: status.data.keepDays })}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('systemSettings.compaction.cursor')}</dt>
                        <dd className="mt-1 font-medium tabular-nums">{status.data.cursorDay ? formatDate(status.data.cursorDay) : '—'}</dd>
                    </div>
                </dl>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            {preview && (
                <p role="status" className="rounded-xl border bg-muted/30 p-3 text-sm">
                    {preview.sampleEvents === 0
                        ? t('systemSettings.compaction.previewEmpty', { date: formatDate(preview.sampleDay) })
                        : t('systemSettings.compaction.previewResult', {
                              date: formatDate(preview.sampleDay),
                              schools: preview.sampleSchools,
                              events: formatNumber(preview.sampleEvents),
                              removable: formatNumber(preview.sampleRemovable),
                              percent: preview.removablePercent ?? 0,
                          })}
                </p>
            )}

            <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t('systemSettings.compaction.historyTitle')}</h3>
                {history.loading && !history.data ? (
                    <LoadingState rows={2} />
                ) : history.error && !history.data ? (
                    <ErrorState message={history.error} onRetry={history.retry} />
                ) : history.data && history.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('systemSettings.compaction.historyEmpty')}</p>
                ) : history.data ? (
                    <div className="max-h-80 overflow-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{t('systemSettings.compaction.colStarted')}</TableHead>
                                    <TableHead>{t('systemSettings.compaction.colStatus')}</TableHead>
                                    <TableHead>{t('systemSettings.compaction.colRows')}</TableHead>
                                    <TableHead>{t('systemSettings.compaction.colFiles')}</TableHead>
                                    <TableHead>{t('systemSettings.compaction.colThrough')}</TableHead>
                                    <TableHead className="pr-4">{t('systemSettings.compaction.colBy')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.data.map((run) => (
                                    <TableRow key={run.id}>
                                        <TableCell className="pl-4 tabular-nums">{formatDateTime(run.startedAt)}</TableCell>
                                        <TableCell className="whitespace-normal">
                                            <StatusBadge tone={TONE[run.status]}>{t(`systemSettings.compaction.statuses.${run.status}`)}</StatusBadge>
                                            {run.error && <span className="mt-1 block text-xs text-destructive [overflow-wrap:anywhere]">{run.error}</span>}
                                        </TableCell>
                                        <TableCell className="tabular-nums">{formatNumber(run.deletedRows)}</TableCell>
                                        <TableCell className="tabular-nums">{formatNumber(run.deletedFiles)}</TableCell>
                                        <TableCell className="tabular-nums">{run.throughDay ? formatDate(run.throughDay) : '—'}</TableCell>
                                        <TableCell className="pr-4">
                                            {run.trigger === 'SCHEDULED' ? t('systemSettings.compaction.byAuto') : (run.startedBy ?? t('systemSettings.compaction.byManual'))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
