import { History, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';

interface SyncHistoryItem {
    id: string;
    status: 'SUCCESS' | 'FAILED';
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    cursorBefore: string | null;
    cursorAfter: string | null;
    errorCode: string | null;
    insertedEvents?: number;
}

interface SyncHistoryResponse {
    success: boolean;
    terminalId: number;
    total: number;
    items: SyncHistoryItem[];
}

/** Sinxronlash tarixi: har bir urinish — natija, davomiylik va cursor. */
export function TerminalSyncHistory({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const query = useApiQuery<SyncHistoryResponse>(`/terminal-sync-monitoring/${terminalId}/history`);
    useInterval(query.retry, 30_000);

    return (
        <section className="min-w-0 space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <History aria-hidden="true" className="size-4 text-primary" />
                        {t('terminals.history.title')}
                    </h3>
                    {query.data && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {t('terminals.history.total', { count: query.data.total })}
                        </p>
                    )}
                </div>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('common.refresh')}
                    title={t('common.refresh')}
                    disabled={query.loading || query.refreshing}
                    onClick={query.retry}
                >
                    <RefreshCw aria-hidden="true" className={cn(query.refreshing && 'animate-spin')} />
                </Button>
            </div>

            {query.loading && (
                <div className="space-y-2" aria-busy="true">
                    <span className="sr-only">{t('terminals.history.loading')}</span>
                    {Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} className="h-9 rounded-lg" />
                    ))}
                </div>
            )}

            {query.error && <p role="alert" className="text-sm text-destructive">{query.error}</p>}

            {query.data && query.data.items.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {t('terminals.history.empty')}
                </p>
            )}

            {query.data && query.data.items.length > 0 && (
                <ol className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                    {query.data.items.map((run) => (
                        <li key={run.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
                            <StatusBadge tone={run.status === 'SUCCESS' ? 'success' : 'danger'} className="row-span-2">
                                {run.status === 'SUCCESS' ? t('terminals.history.success') : t('terminals.history.failed')}
                            </StatusBadge>
                            <span className="truncate font-medium">{formatDateTime(run.startedAt)}</span>
                            <span className="text-right text-muted-foreground tabular-nums">
                                {(run.insertedEvents ?? 0) > 0 && (
                                    <span className="mr-2 font-semibold text-success">
                                        {t('terminals.history.newEvents', { count: run.insertedEvents })}
                                    </span>
                                )}
                                {t('terminals.history.seconds', { value: (run.durationMs / 1000).toFixed(2) })}
                            </span>
                            <span className="col-span-2 truncate text-muted-foreground" title={run.errorCode ?? undefined}>
                                {run.errorCode
                                    ? <span className="text-destructive">{run.errorCode}</span>
                                    : <>{t('terminals.history.cursor')}: {formatDateTime(run.cursorAfter)}</>}
                            </span>
                        </li>
                    ))}
                </ol>
            )}

            {query.data && <p className="text-xs text-muted-foreground">{t('terminals.history.note')}</p>}
        </section>
    );
}
