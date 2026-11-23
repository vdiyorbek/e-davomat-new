import { History, WifiOff, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime } from '@/lib/date';

import { formatDelay } from './terminal-status';

interface LogItem {
    at: string;
    kind: 'SYNC' | 'OFFLINE';
    detail: string | null;
    endedAt: string | null;
    durationMinutes: number | null;
}

/** Oxirgi 20 ta muammo: sinxronlash xatolari va offline bo‘lgan davrlar. */
export function TerminalErrorLog({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<LogItem[]>(`/terminals/${terminalId}/error-log`);

    return (
        <section className="space-y-3 rounded-xl border bg-card p-4">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <History aria-hidden="true" className="size-4 text-primary" />
                    {t('terminals.errorLog.title')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{t('terminals.errorLog.note')}</p>
            </div>
            {loading ? (
                <LoadingState rows={3} />
            ) : error ? (
                <ErrorState message={error || t('terminals.errorLog.failed')} onRetry={retry} />
            ) : !data || data.length === 0 ? (
                <EmptyState icon={History} title={t('terminals.errorLog.empty')} />
            ) : (
                <ol className="max-h-80 list-none divide-y overflow-y-auto rounded-lg border">
                    {data.map((item) => {
                        const offline = item.kind === 'OFFLINE';
                        const Icon = offline ? WifiOff : TriangleAlert;
                        return (
                            <li key={`${item.kind}-${item.at}`} className="flex items-start gap-3 px-3 py-2.5 text-xs">
                                <Icon aria-hidden="true" className={offline ? 'mt-0.5 size-4 shrink-0 text-destructive' : 'mt-0.5 size-4 shrink-0 text-warning'} />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <StatusBadge tone={offline ? 'danger' : 'warning'} dot={false}>
                                            {t(`terminals.errorLog.kinds.${item.kind}`)}
                                        </StatusBadge>
                                        <span className="font-medium tabular-nums">{formatDateTime(item.at)}</span>
                                    </div>
                                    {offline && item.durationMinutes !== null && (
                                        <p className="text-muted-foreground">
                                            {item.endedAt
                                                ? t('terminals.errorLog.lasted', { duration: formatDelay(item.durationMinutes * 60, t) })
                                                : t('terminals.errorLog.ongoing')}
                                        </p>
                                    )}
                                    {item.detail && (
                                        <p className="text-muted-foreground [overflow-wrap:anywhere]">
                                            {item.kind === 'SYNC'
                                                ? t(`terminals.history.errors.${item.detail}`, { defaultValue: item.detail })
                                                : item.detail}
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
