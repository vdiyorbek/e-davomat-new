import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/states';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime, formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

type CheckStatus = 'SUCCESS' | 'TIMEOUT' | 'ERROR';

interface HistoryItem {
    id: string;
    status: CheckStatus;
    databaseTeachers: number | null;
    terminalUsers: number | null;
    missingCount: number | null;
    invalidPnfl: number | null;
    durationMs: number;
    errorCode: string | null;
    jobId: string | null;
    checkedAt: string;
}

interface HistoryResponse {
    terminal: { id: number; name: string; schoolId: number; isActive: boolean };
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
    checks: HistoryItem[];
}

const TONES = { SUCCESS: 'success', TIMEOUT: 'danger', ERROR: 'warning' } as const;

function HistoryContent({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const { data, loading, error, retry } = useApiQuery<HistoryResponse>(
        `/person-sync-queue/monitoring/terminals/${terminalId}/history?page=${page}&limit=10`,
    );

    if (loading) return <LoadingState rows={4} />;
    if (error || !data) return <ErrorState message={error || t('terminals.monitoring.historyFailed')} onRetry={retry} />;

    const value = (n: number | null) => (n === null ? '—' : formatNumber(n));

    return (
        <div className="space-y-4">
            <dl className="grid grid-cols-3 divide-x rounded-xl border bg-muted/25 text-center text-sm">
                <div className="px-2 py-2.5">
                    <dt className="text-xs text-muted-foreground">{t('terminals.monitoring.columns.school')}</dt>
                    <dd className="font-mono font-semibold">{data.terminal.schoolId}</dd>
                </div>
                <div className="px-2 py-2.5">
                    <dt className="text-xs text-muted-foreground">{t('terminals.monitoring.terminalState')}</dt>
                    <dd className="font-semibold">{data.terminal.isActive ? t('terminals.system.active') : t('terminals.system.inactive')}</dd>
                </div>
                <div className="px-2 py-2.5">
                    <dt className="text-xs text-muted-foreground">{t('terminals.monitoring.checksCount')}</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(data.pagination.totalItems)}</dd>
                </div>
            </dl>

            {data.checks.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t('terminals.monitoring.historyEmpty')}
                </p>
            ) : (
                <ol className="space-y-2">
                    {data.checks.map((check) => (
                        <li key={check.id} className="space-y-3 rounded-xl border p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusBadge tone={TONES[check.status]}>
                                    {t(`terminals.monitoring.statuses.${check.status}`)}
                                </StatusBadge>
                                <span className="text-xs text-muted-foreground">{formatDateTime(check.checkedAt)}</span>
                            </div>
                            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                {[
                                    ['teachers', value(check.databaseTeachers)],
                                    ['onTerminal', value(check.terminalUsers)],
                                    ['missing', value(check.missingCount)],
                                    ['duration', t('terminals.monitoring.seconds', { value: (check.durationMs / 1000).toFixed(1) })],
                                ].map(([key, text]) => (
                                    <div key={key}>
                                        <dt className="text-xs text-muted-foreground">{t(`terminals.monitoring.columns.${key}`)}</dt>
                                        <dd className={cn('font-semibold tabular-nums', key === 'missing' && (check.missingCount ?? 0) > 0 && 'text-destructive')}>
                                            {text}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            {check.errorCode && (
                                <p className="text-sm text-destructive">{t('terminals.monitoring.error', { error: check.errorCode })}</p>
                            )}
                            {check.jobId && (
                                <p className="font-mono text-xs break-all text-muted-foreground">Job ID: {check.jobId}</p>
                            )}
                        </li>
                    ))}
                </ol>
            )}

            <Pagination
                page={data.pagination.page}
                totalPages={Math.max(1, data.pagination.totalPages)}
                total={data.pagination.totalItems}
                pageSize={data.pagination.limit}
                shownCount={data.checks.length}
                onPageChange={setPage}
            />
        </div>
    );
}

export function TerminalMonitoringDialog({
    terminalId,
    onClose,
}: {
    terminalId: number | null;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Dialog open={terminalId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('terminals.monitoring.dialogTitle')}
                        {terminalId !== null && <span className="font-mono text-muted-foreground"> · #{terminalId}</span>}
                    </DialogTitle>
                    <DialogDescription>{t('terminals.monitoring.dialogDescription')}</DialogDescription>
                </DialogHeader>
                {terminalId !== null && <HistoryContent key={terminalId} terminalId={terminalId} />}
            </DialogContent>
        </Dialog>
    );
}
