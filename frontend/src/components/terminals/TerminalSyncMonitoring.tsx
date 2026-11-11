import { Activity, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

interface SyncMonitoringResponse {
    terminalId: number;
    queueName: string;
    state: string;
    attemptsMade: number;
    maxAttempts: number;
    jobId: string | null;
    lastFailedReason: string | null;
    queue: {
        waiting: number;
        active: number;
        delayed: number;
        failed: number;
    };
    sync: {
        syncStartAt: string | null;
        eventsSyncedUntil: string | null;
        lastSuccessfulSyncAt: string | null;
    };
    checkedAt: string;
}

const KNOWN_STATES = ['active', 'waiting', 'delayed', 'failed', 'completed', 'waitingChildren', 'idle'];

export function TerminalSyncMonitoring({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const query = useApiQuery<SyncMonitoringResponse>(`/terminal-sync-monitoring/${terminalId}`);
    useInterval(query.retry, 15_000);

    const data = query.data;
    const stateLabel = data
        ? KNOWN_STATES.includes(data.state)
            ? t(`terminals.queue.states.${data.state}`)
            : data.state
        : '';

    const counters = data
        ? [
            { label: t('terminals.queue.waiting'), value: data.queue.waiting },
            { label: t('terminals.queue.active'), value: data.queue.active },
            { label: t('terminals.queue.delayed'), value: data.queue.delayed },
            { label: t('terminals.queue.failed'), value: data.queue.failed, danger: data.queue.failed > 0 },
        ]
        : [];

    return (
        <section className="min-w-0 space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Activity aria-hidden="true" className="size-4 text-primary" />
                    {t('terminals.queue.title')}
                </h3>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('common.refresh')}
                    title={t('common.refresh')}
                    onClick={query.retry}
                    disabled={query.loading || query.refreshing}
                >
                    <RefreshCw aria-hidden="true" className={cn(query.refreshing && 'animate-spin')} />
                </Button>
            </div>

            {query.loading && (
                <div className="space-y-2" aria-busy="true">
                    <span className="sr-only">{t('terminals.queue.loading')}</span>
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                </div>
            )}

            {query.error && <p role="alert" className="text-sm text-destructive">{query.error}</p>}

            {data && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                        <div>
                            <div className="text-xs text-muted-foreground">{t('terminals.queue.currentState')}</div>
                            <div className="font-semibold">{stateLabel}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">{t('terminals.queue.attempts')}</div>
                            <div className="font-semibold tabular-nums">
                                {data.attemptsMade} / {data.maxAttempts || '—'}
                            </div>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                        {counters.map((item) => (
                            <div key={item.label} className="min-w-0 rounded-lg border px-3 py-2">
                                <dt className="truncate text-[11px] text-muted-foreground">{item.label}</dt>
                                <dd className={cn('text-lg font-semibold tabular-nums', item.danger && 'text-destructive')}>
                                    {formatNumber(item.value)}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <dl className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-muted-foreground">{t('terminals.queue.syncedUntil')}</dt>
                            <dd className="font-medium">{formatDateTime(data.sync.eventsSyncedUntil)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">{t('terminals.queue.lastSync')}</dt>
                            <dd className="font-medium">{formatDateTime(data.sync.lastSuccessfulSyncAt)}</dd>
                        </div>
                    </dl>

                    {data.lastFailedReason && (
                        <p role="alert" className="rounded-lg bg-destructive/8 p-2.5 text-xs break-words text-destructive">
                            {t('terminals.queue.jobError', { error: data.lastFailedReason })}
                        </p>
                    )}

                    <p className="text-xs text-muted-foreground">{t('terminals.queue.note')}</p>
                </>
            )}
        </section>
    );
}
