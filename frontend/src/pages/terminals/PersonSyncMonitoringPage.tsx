import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Eye, RefreshCw, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { PersonSyncRecheckButton } from '@/components/terminals/PersonSyncRecheckButton';
import { TerminalMonitoringDialog } from '@/components/terminals/TerminalMonitoringDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime, formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

type SyncStatus = 'SUCCESS' | 'TIMEOUT' | 'ERROR' | 'NOT_CHECKED';
type StatusFilter = SyncStatus | 'ALL';

interface TerminalItem {
    terminalId: number;
    terminalName: string;
    schoolId: number;
    status: SyncStatus;
    databaseTeachers: number | null;
    terminalUsers: number | null;
    missingCount: number | null;
    invalidPnfl: number | null;
    durationMs: number | null;
    errorCode: string | null;
    checkedAt: string | null;
    jobId: string | null;
}

interface MonitoringResponse {
    generatedAt: string;
    summary: {
        totalTerminals: number;
        success: number;
        timeout: number;
        error: number;
        notChecked: number;
        terminalsWithMissingTeachers: number;
        missingTeachersTotal: number;
    };
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
    filters: {
        status: StatusFilter;
        schoolId: number | null;
    };
    terminals: TerminalItem[];
}

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'SUCCESS', 'TIMEOUT', 'ERROR', 'NOT_CHECKED'];

const statusTones = {
    SUCCESS: 'success',
    TIMEOUT: 'danger',
    ERROR: 'warning',
    NOT_CHECKED: 'neutral',
} as const;

function numberOrDash(value: number | null) {
    return value === null ? '—' : formatNumber(value);
}

export function PersonSyncMonitoringPage() {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [status, setStatus] = useState<StatusFilter>('ALL');
    const [schoolInput, setSchoolInput] = useState('');
    const [schoolId, setSchoolId] = useState<number | null>(null);
    const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);

    const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
    if (schoolId !== null) params.set('schoolId', String(schoolId));

    const { data, loading, refreshing, error, retry } = useApiQuery<MonitoringResponse>(
        `/person-sync-queue/monitoring?${params.toString()}`,
    );

    function applySchoolFilter() {
        const trimmed = schoolInput.trim();
        if (!trimmed) {
            setSchoolId(null);
            setPage(1);
            return;
        }
        const parsed = Number(trimmed);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) return;
        setSchoolId(parsed);
        setPage(1);
    }

    const statusLabel = (value: StatusFilter) => t(`terminals.monitoring.statuses.${value}`);
    const duration = (ms: number | null) =>
        ms === null ? '—' : t('terminals.monitoring.seconds', { value: (ms / 1000).toFixed(1) });

    return (
        <div className="w-full min-w-0 space-y-5">
            <PageHeader
                eyebrow={t('terminals.eyebrow')}
                title={t('terminals.monitoring.title')}
                description={t('terminals.monitoring.description')}
                actions={
                    <Button type="button" variant="outline" onClick={retry} disabled={loading || refreshing}>
                        <RefreshCw aria-hidden="true" className={cn((loading || refreshing) && 'animate-spin')} />
                        {t('common.refresh')}
                    </Button>
                }
            />

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t('terminals.monitoring.totalTerminals')} value={data?.summary.totalTerminals ?? 0} icon={Server} tone="primary" loading={loading} />
                <KpiCard label={statusLabel('SUCCESS')} value={data?.summary.success ?? 0} icon={CheckCircle2} tone="success" loading={loading} />
                <KpiCard label={statusLabel('TIMEOUT')} value={data?.summary.timeout ?? 0} icon={Clock3} tone="danger" loading={loading} />
                <KpiCard label={statusLabel('ERROR')} value={data?.summary.error ?? 0} icon={AlertTriangle} tone="warning" loading={loading} />
            </section>

            {data && (
                <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">{statusLabel('NOT_CHECKED')}:</dt>
                        <dd className="font-semibold tabular-nums">{formatNumber(data.summary.notChecked)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">{t('terminals.monitoring.missingTerminals')}:</dt>
                        <dd className="font-semibold tabular-nums">{formatNumber(data.summary.terminalsWithMissingTeachers)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">{t('terminals.monitoring.missingTotal')}:</dt>
                        <dd className="font-semibold tabular-nums">{formatNumber(data.summary.missingTeachersTotal)}</dd>
                    </div>
                </dl>
            )}

            <Card className="min-w-0 gap-0 py-0">
                <div className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,12rem))_auto] lg:items-end">
                    <Field label={t('terminals.monitoring.statusFilter')}>
                        <SelectField
                            value={status}
                            onValueChange={(value) => {
                                setStatus(value as StatusFilter);
                                setPage(1);
                            }}
                            options={STATUS_FILTERS.map((value) => ({ value, label: statusLabel(value) }))}
                            aria-label={t('terminals.monitoring.statusFilter')}
                        />
                    </Field>
                    <Field htmlFor="monitoring-school" label={t('terminals.monitoring.schoolId')}>
                        <form
                            className="flex gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                applySchoolFilter();
                            }}
                        >
                            <Input
                                id="monitoring-school"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                value={schoolInput}
                                onChange={(event) => setSchoolInput(event.target.value)}
                                placeholder={t('terminals.monitoring.schoolIdPlaceholder')}
                                className="bg-background"
                            />
                            <Button type="submit" variant="outline">{t('terminals.monitoring.apply')}</Button>
                        </form>
                    </Field>
                    <Field label={t('terminals.monitoring.pageSize')}>
                        <SelectField
                            value={String(limit)}
                            onValueChange={(value) => {
                                setLimit(Number(value));
                                setPage(1);
                            }}
                            options={[10, 20, 50, 100].map((size) => ({ value: String(size), label: String(size) }))}
                            aria-label={t('terminals.monitoring.pageSize')}
                        />
                    </Field>
                </div>

                <div className="space-y-4 p-4">
                    {loading ? (
                        <LoadingState rows={5} className="border-0 p-0 sm:p-0" />
                    ) : error || !data ? (
                        <ErrorState message={error || t('terminals.monitoring.loadFailed')} onRetry={retry} />
                    ) : data.terminals.length === 0 ? (
                        <EmptyState
                            icon={Server}
                            title={t('terminals.monitoring.emptyTitle')}
                            description={t('terminals.monitoring.empty')}
                        />
                    ) : (
                        <>
                            {/* Kompyuter: jadval */}
                            <div className="hidden overflow-x-auto rounded-xl border lg:block">
                                <table className="w-full min-w-[880px] text-sm">
                                    <thead className="border-b bg-muted/50 text-left">
                                        <tr className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                            {(['terminal', 'school', 'status', 'teachers', 'onTerminal', 'missing', 'duration', 'checkedAt'] as const).map((key) => (
                                                <th key={key} className="px-3 py-2.5">{t(`terminals.monitoring.columns.${key}`)}</th>
                                            ))}
                                            <th className="px-3 py-2.5 text-right">{t('terminals.monitoring.columns.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.terminals.map((item) => (
                                            <tr key={item.terminalId} className="align-top hover:bg-muted/30">
                                                <td className="px-3 py-3">
                                                    <div className="font-semibold">{item.terminalName}</div>
                                                    <div className="font-mono text-xs text-muted-foreground">#{item.terminalId}</div>
                                                </td>
                                                <td className="px-3 py-3 font-mono text-xs">{item.schoolId}</td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge tone={statusTones[item.status]}>{statusLabel(item.status)}</StatusBadge>
                                                    {item.errorCode && (
                                                        <p className="mt-1 max-w-48 text-xs break-words text-destructive">{item.errorCode}</p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 tabular-nums">{numberOrDash(item.databaseTeachers)}</td>
                                                <td className="px-3 py-3 tabular-nums">{numberOrDash(item.terminalUsers)}</td>
                                                <td className={cn('px-3 py-3 font-semibold tabular-nums', (item.missingCount ?? 0) > 0 && 'text-destructive')}>
                                                    {numberOrDash(item.missingCount)}
                                                </td>
                                                <td className="px-3 py-3 tabular-nums">{duration(item.durationMs)}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(item.checkedAt)}</td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col items-end gap-2">
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedTerminalId(item.terminalId)}>
                                                            <Eye aria-hidden="true" />
                                                            {t('terminals.monitoring.details')}
                                                        </Button>
                                                        <PersonSyncRecheckButton terminalId={item.terminalId} onFinished={retry} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Telefon va planshet: kartalar */}
                            <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                                {data.terminals.map((item) => (
                                    <li key={item.terminalId} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-heading font-bold">{item.terminalName}</p>
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    #{item.terminalId} · {t('terminals.monitoring.columns.school')} {item.schoolId}
                                                </p>
                                            </div>
                                            <StatusBadge tone={statusTones[item.status]}>{statusLabel(item.status)}</StatusBadge>
                                        </div>
                                        {item.errorCode && <p className="text-xs break-words text-destructive">{item.errorCode}</p>}
                                        <dl className="grid grid-cols-3 divide-x rounded-lg border bg-muted/30 text-center">
                                            {[
                                                ['teachers', numberOrDash(item.databaseTeachers)],
                                                ['onTerminal', numberOrDash(item.terminalUsers)],
                                                ['missing', numberOrDash(item.missingCount)],
                                            ].map(([key, value]) => (
                                                <div key={key} className="min-w-0 px-2 py-2">
                                                    <dt className="truncate text-[11px] text-muted-foreground">{t(`terminals.monitoring.columns.${key}`)}</dt>
                                                    <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDateTime(item.checkedAt)} · {duration(item.durationMs)}
                                        </p>
                                        <div className="mt-auto flex flex-wrap items-start justify-between gap-2">
                                            <PersonSyncRecheckButton terminalId={item.terminalId} onFinished={retry} />
                                            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedTerminalId(item.terminalId)}>
                                                <Eye aria-hidden="true" />
                                                {t('terminals.monitoring.details')}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <Pagination
                                page={data.pagination.page}
                                totalPages={Math.max(data.pagination.totalPages, 1)}
                                total={data.pagination.totalItems}
                                pageSize={data.pagination.limit}
                                shownCount={data.terminals.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </div>
            </Card>

            <TerminalMonitoringDialog terminalId={selectedTerminalId} onClose={() => setSelectedTerminalId(null)} />
        </div>
    );
}
