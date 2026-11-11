import { useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedPost } from '@/lib/auth-session';
import { formatDateTime, formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

import { StatTile } from './StatTile';

interface PhotoStats {
    terminalId: number;
    total: number;
    pending: number;
    downloaded: number;
    failed: number;
    missing: number;
}

interface StatsResponse {
    success: boolean;
    terminals: PhotoStats[];
}

interface PhotoIssue {
    eventId: string;
    eventAt: string;
    status: 'FAILED' | 'MISSING';
    attempts: number;
    lastAttemptAt: string | null;
    lastError: string | null;
}

interface IssuesResponse {
    success: boolean;
    terminalId: number;
    total: number;
    items: PhotoIssue[];
}

interface RetryResponse {
    success: boolean;
    terminalId: number;
    reset: number;
}

interface Props {
    terminalId: number;
    canManage: boolean;
}

export function TerminalPhotoStats({ terminalId, canManage }: Props) {
    const { t } = useTranslation();
    const statsQuery = useApiQuery<StatsResponse>(`/attendance-events/photos/stats?terminalId=${terminalId}`);
    const issuesQuery = useApiQuery<IssuesResponse>(`/attendance-events/photos/${terminalId}/issues?limit=50`);

    const [busy, setBusy] = useState(false);
    const [busyEventId, setBusyEventId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [actionError, setActionError] = useState('');

    function refresh() {
        statsQuery.retry();
        issuesQuery.retry();
    }

    useInterval(refresh, 30_000);

    const stats = statsQuery.data?.terminals.find((item) => item.terminalId === terminalId);
    const issues = issuesQuery.data;
    const refreshing = statsQuery.refreshing || issuesQuery.refreshing;

    async function retryMissing() {
        if (!canManage || busy) return;
        setBusy(true);
        setMessage('');
        setActionError('');
        try {
            const result = await authorizedPost<RetryResponse>(
                `/attendance-events/photos/${terminalId}/retry-missing`,
                {},
            );
            setMessage(t('terminals.photos.retryMissingDone', { count: result.reset }));
            refresh();
        } catch (caught: unknown) {
            setActionError(caught instanceof Error ? caught.message : t('terminals.photos.retryFailed'));
        } finally {
            setBusy(false);
        }
    }

    async function retrySingle(eventId: string) {
        if (!canManage || busyEventId !== null) return;
        setBusyEventId(eventId);
        setMessage('');
        setActionError('');
        try {
            await authorizedPost(`/attendance-events/photos/${terminalId}/events/${eventId}/retry`, {});
            setMessage(t('terminals.photos.retrySingleDone', { id: eventId }));
            refresh();
        } catch (caught: unknown) {
            setActionError(caught instanceof Error ? caught.message : t('terminals.photos.retryFailed'));
        } finally {
            setBusyEventId(null);
        }
    }

    const percentage = stats && stats.total > 0 ? (stats.downloaded / stats.total) * 100 : 0;

    return (
        <section className="min-w-0 space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Camera aria-hidden="true" className="size-4 text-primary" />
                        {t('terminals.photos.title')}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('terminals.photos.autoRefresh')}</p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.refresh')}
                    title={t('common.refresh')}
                    onClick={refresh}
                    disabled={statsQuery.loading || issuesQuery.loading || refreshing}
                >
                    <RefreshCw aria-hidden="true" className={cn(refreshing && 'animate-spin')} />
                </Button>
            </div>

            {statsQuery.loading && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-busy="true">
                    <span className="sr-only">{t('terminals.photos.loading')}</span>
                    {Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} className="h-[72px] rounded-xl" />
                    ))}
                </div>
            )}

            {statsQuery.error && <p role="alert" className="text-sm text-destructive">{statsQuery.error}</p>}

            {stats && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile label={t('terminals.photos.downloaded')} value={stats.downloaded} tone="success" />
                        <StatTile label={t('terminals.photos.pending')} value={stats.pending} />
                        <StatTile label={t('terminals.photos.failed')} value={stats.failed} tone={stats.failed > 0 ? 'danger' : undefined} />
                        <StatTile label={t('terminals.photos.missing')} value={stats.missing} tone={stats.missing > 0 ? 'warning' : undefined} />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{t('terminals.photos.progress')}</span>
                            <span className="font-semibold text-foreground tabular-nums">{Math.round(percentage)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            {t('terminals.photos.totalEvents', { count: stats.total })}
                        </p>
                    </div>

                    {canManage && stats.missing > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={busy}
                            onClick={() => void retryMissing()}
                        >
                            <RefreshCw aria-hidden="true" />
                            {busy ? t('terminals.photos.preparing') : t('terminals.photos.retryMissing')}
                        </Button>
                    )}
                </div>
            )}

            {message && <p role="status" className="text-sm font-medium text-success">{message}</p>}
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}

            <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{t('terminals.photos.issuesTitle')}</h4>
                    {issues && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                            {formatNumber(issues.total)}
                        </span>
                    )}
                </div>

                {issuesQuery.loading && <Skeleton className="h-24 rounded-lg" aria-label={t('terminals.photos.issuesLoading')} />}
                {issuesQuery.error && <p role="alert" className="text-xs text-destructive">{issuesQuery.error}</p>}

                {issues && issues.items.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        {t('terminals.photos.issuesEmpty')}
                    </p>
                )}

                {issues && issues.items.length > 0 && (
                    <div className="max-h-80 overflow-auto rounded-lg border">
                        <table className="w-full min-w-[640px] text-left text-xs">
                            <thead className="sticky top-0 z-10 bg-muted">
                                <tr className="text-muted-foreground">
                                    <th className="px-3 py-2 font-semibold">{t('terminals.photos.eventId')}</th>
                                    <th className="px-3 py-2 font-semibold">{t('terminals.photos.date')}</th>
                                    <th className="px-3 py-2 font-semibold">{t('terminals.photos.status')}</th>
                                    <th className="px-3 py-2 font-semibold">{t('terminals.photos.attempts')}</th>
                                    <th className="px-3 py-2 font-semibold">{t('terminals.photos.reason')}</th>
                                    {canManage && <th className="px-3 py-2" />}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {issues.items.map((item) => (
                                    <tr key={item.eventId} className="align-top">
                                        <td className="px-3 py-2 font-mono">{item.eventId}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.eventAt)}</td>
                                        <td className="px-3 py-2">
                                            <StatusBadge tone={item.status === 'FAILED' ? 'danger' : 'warning'}>
                                                {t(`terminals.photos.statuses.${item.status}`)}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">
                                            {item.attempts}
                                            {item.lastAttemptAt && (
                                                <div className="whitespace-nowrap text-muted-foreground">
                                                    {formatDateTime(item.lastAttemptAt)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="max-w-[260px] px-3 py-2 break-words text-muted-foreground" title={item.lastError ?? undefined}>
                                            {item.lastError ?? t('terminals.photos.noReason')}
                                        </td>
                                        {canManage && (
                                            <td className="px-3 py-1.5 text-right">
                                                <Button
                                                    type="button"
                                                    size="xs"
                                                    variant="outline"
                                                    disabled={busyEventId !== null || busy}
                                                    onClick={() => void retrySingle(item.eventId)}
                                                >
                                                    <RefreshCw aria-hidden="true" />
                                                    {busyEventId === item.eventId
                                                        ? t('terminals.photos.sending')
                                                        : t('terminals.photos.retry')}
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {issues && issues.total > issues.items.length && (
                    <p className="text-xs text-muted-foreground">
                        {t('terminals.photos.shownLast', { count: issues.items.length })}
                    </p>
                )}
            </div>

            <p className="text-xs text-muted-foreground">{t('terminals.photos.note')}</p>
        </section>
    );
}
