import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Field } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, formatNumber } from '@/lib/date';

import { ListHeader } from './EventSyncHistorySection';

interface ClearRun {
    id: string;
    terminalId: number;
    terminalName: string | null;
    requestedByUserId: number | null;
    requestedByName: string | null;
    status: string;
    usersBefore: number | null;
    usersAfter: number | null;
    facesAfter: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
}

interface ClearHistoryResponse {
    runs: ClearRun[];
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

const STATUSES = ['QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'];
const ACTIVE = ['QUEUED', 'RUNNING'];
const ERROR_CODES = [
    'TERMINAL_BUSY',
    'DEVICE_AUTH_FAILED',
    'CLEAR_NOT_SUPPORTED',
    'CLEAR_TIMEOUT',
    'CLEAR_FAILED',
    'CLEAR_REJECTED',
    'QUEUE_ERROR',
    'TIMEOUT',
    'CONNECTION_ERROR',
    'PERSON_SYNC_LOCK_LOST',
];

function statusTone(status: string): StatusTone {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'danger';
    if (status === 'PARTIAL') return 'warning';
    if (ACTIVE.includes(status)) return 'info';
    return 'neutral';
}

function statusLabel(status: string, t: TFunction) {
    return STATUSES.includes(status) ? t(`syncHistory.clears.statuses.${status}`) : status;
}

function errorLabel(code: string, t: TFunction) {
    return ERROR_CODES.includes(code) ? t(`syncHistory.clears.errors.${code}`) : code;
}

function show(value: number | null) {
    return value === null ? '—' : formatNumber(value);
}

function ResultCell({ run }: { run: ClearRun }) {
    const { t } = useTranslation();

    if (run.usersBefore === null) {
        return <span className="text-sm text-muted-foreground">—</span>;
    }

    return (
        <div className="space-y-0.5">
            <div className="font-semibold tabular-nums">
                {show(run.usersBefore)} → {show(run.usersAfter)}
            </div>
            <div className="text-xs text-muted-foreground">
                {t('syncHistory.clears.facesLeft', { value: show(run.facesAfter) })}
            </div>
        </div>
    );
}

/** Terminal xotirasini tozalash amallari tarixi. */
export function ClearHistorySection() {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [terminalInput, setTerminalInput] = useState('');
    const [terminalId, setTerminalId] = useState('');
    const [filterError, setFilterError] = useState('');

    const params = new URLSearchParams({ page: String(page), limit: '20', status });
    if (terminalId) params.set('terminalId', terminalId);

    const { data, loading, refreshing, error, retry } = useApiQuery<ClearHistoryResponse>(
        `/person-sync-queue/clear-history?${params.toString()}`,
    );

    const runs = data?.runs ?? [];
    const activeCount = runs.filter((run) => ACTIVE.includes(run.status)).length;

    // Jarayondagi tozalash bo‘lsa — tezroq yangilaymiz.
    useInterval(retry, activeCount > 0 ? 5_000 : 15_000);

    function applyTerminal() {
        const value = terminalInput.trim();
        if (value && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295)) {
            setFilterError(t('syncHistory.filters.invalidTerminal'));
            return;
        }
        setFilterError('');
        setTerminalId(value);
        setPage(1);
    }

    function resetFilters() {
        setStatus('ALL');
        setTerminalInput('');
        setTerminalId('');
        setFilterError('');
        setPage(1);
    }

    const hasFilters = status !== 'ALL' || Boolean(terminalId);

    return (
        <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label={t('syncHistory.clears.kpi.total')}
                    value={data?.pagination.totalItems ?? 0}
                    icon={Eraser}
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.clears.kpi.running')}
                    value={activeCount}
                    hint={t('syncHistory.events.onPage')}
                    icon={Loader2}
                    tone="primary"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.clears.kpi.success')}
                    value={runs.filter((run) => run.status === 'SUCCESS').length}
                    hint={t('syncHistory.events.onPage')}
                    icon={CheckCircle2}
                    tone="success"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.clears.kpi.problems')}
                    value={runs.filter((run) => run.status === 'FAILED' || run.status === 'PARTIAL').length}
                    hint={t('syncHistory.events.onPage')}
                    icon={AlertTriangle}
                    tone="warning"
                    loading={loading}
                />
            </div>

            <Card className="min-w-0 gap-0 py-0">
                <form
                    className="space-y-3 border-b bg-muted/20 p-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        applyTerminal();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,16rem))_auto] lg:items-end">
                        <Field label={t('syncHistory.filters.status')}>
                            <SelectField
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value);
                                    setPage(1);
                                }}
                                options={[
                                    { value: 'ALL', label: t('syncHistory.filters.all') },
                                    ...STATUSES.map((value) => ({ value, label: statusLabel(value, t) })),
                                ]}
                                aria-label={t('syncHistory.filters.status')}
                            />
                        </Field>
                        <Field htmlFor="clear-history-terminal" label={t('syncHistory.filters.terminalId')}>
                            <Input
                                id="clear-history-terminal"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                value={terminalInput}
                                onChange={(event) => setTerminalInput(event.target.value)}
                                placeholder={t('syncHistory.filters.terminalPlaceholder')}
                                className="bg-background"
                            />
                        </Field>
                        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                            <Button type="submit" className="flex-1 lg:flex-none">{t('syncHistory.filters.apply')}</Button>
                            {hasFilters && (
                                <Button type="button" variant="ghost" onClick={resetFilters}>
                                    <X aria-hidden="true" />
                                    {t('syncHistory.filters.reset')}
                                </Button>
                            )}
                        </div>
                    </div>
                    {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
                </form>

                <ListHeader
                    title={t('syncHistory.clears.title')}
                    hint={t('syncHistory.clears.hint')}
                    total={data?.pagination.totalItems}
                    refreshing={refreshing}
                    onRefresh={retry}
                />

                <div className="space-y-4 p-4">
                    {loading ? (
                        <LoadingState rows={5} className="border-0 p-0 sm:p-0" />
                    ) : error || !data ? (
                        <ErrorState message={error || t('syncHistory.common.loadFailed')} onRetry={retry} />
                    ) : runs.length === 0 ? (
                        <EmptyState
                            icon={Eraser}
                            title={t('syncHistory.clears.emptyTitle')}
                            description={t('syncHistory.clears.empty')}
                        />
                    ) : (
                        <>
                            {/* Kompyuter: jadval */}
                            <div className="hidden overflow-x-auto rounded-xl border lg:block">
                                <table className="w-full min-w-[880px] text-sm">
                                    <thead className="border-b bg-muted/50 text-left">
                                        <tr className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                            {(['terminal', 'status', 'result', 'requestedBy', 'time', 'error'] as const).map((key) => (
                                                <th key={key} className="px-3 py-2.5">{t(`syncHistory.clears.columns.${key}`)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {runs.map((run) => (
                                            <tr key={run.id} className="align-top hover:bg-muted/30">
                                                <td className="px-3 py-3">
                                                    <div className="max-w-56 truncate font-semibold">
                                                        {run.terminalName ?? t('syncHistory.common.terminal')}
                                                    </div>
                                                    <div className="font-mono text-xs text-muted-foreground">#{run.terminalId}</div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge tone={statusTone(run.status)}>{statusLabel(run.status, t)}</StatusBadge>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <ResultCell run={run} />
                                                </td>
                                                <td className="px-3 py-3">
                                                    {run.requestedByName ?? t('syncHistory.clears.unknownUser')}
                                                </td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                    <div>{formatDateTime(run.startedAt ?? run.createdAt, '—')}</div>
                                                    <div className="text-muted-foreground">→ {formatDateTime(run.finishedAt, '—')}</div>
                                                </td>
                                                <td
                                                    className="max-w-48 px-3 py-3 text-xs text-destructive"
                                                    title={run.errorMessage ?? undefined}
                                                >
                                                    {run.errorCode ? errorLabel(run.errorCode, t) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Telefon va planshet: kartochkalar */}
                            <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                                {runs.map((run) => (
                                    <li key={run.id} className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">
                                                    {run.terminalName ?? t('syncHistory.common.terminal')}
                                                </p>
                                                <p className="font-mono text-xs text-muted-foreground">#{run.terminalId}</p>
                                            </div>
                                            <StatusBadge tone={statusTone(run.status)}>{statusLabel(run.status, t)}</StatusBadge>
                                        </div>
                                        <ResultCell run={run} />
                                        <p className="text-xs text-muted-foreground">
                                            {t('syncHistory.clears.by', {
                                                name: run.requestedByName ?? t('syncHistory.clears.unknownUser'),
                                            })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDateTime(run.startedAt ?? run.createdAt, '—')} → {formatDateTime(run.finishedAt, '—')}
                                        </p>
                                        {run.errorCode && (
                                            <p
                                                className="rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs break-words text-destructive"
                                                title={run.errorMessage ?? undefined}
                                            >
                                                {errorLabel(run.errorCode, t)}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <Pagination
                                page={data.pagination.page}
                                totalPages={Math.max(1, data.pagination.totalPages)}
                                total={data.pagination.totalItems}
                                pageSize={data.pagination.limit}
                                shownCount={runs.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
