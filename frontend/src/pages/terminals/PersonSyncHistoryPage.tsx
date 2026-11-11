import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, ListChecks, Loader2, RefreshCw, SkipForward, Users, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Field } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, formatNumber } from '@/lib/date';

import { ListHeader } from './EventSyncHistorySection';

type Counts = Record<string, number>;

interface Batch {
    id: string;
    requestedByUserId: number | null;
    type: 'STUDENT' | 'TEACHER' | 'BOTH';
    status: string;
    terminalCount: number;
    totalItems: number;
    queuedItems: number;
    createdAt: string;
    finishedAt: string | null;
    counts: Counts;
}

interface PaginationInfo {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}

interface HistoryResponse {
    batches: Batch[];
    pagination: PaginationInfo;
}

interface HistoryItem {
    id: string;
    terminalId: number;
    terminalName: string | null;
    personId: number;
    personName?: string | null;
    jobId: string | null;
    status: string;
    attempts: number;
    errorCode: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
}

interface DetailResponse {
    batch: Batch;
    counts: Counts;
    pagination: PaginationInfo;
    items: HistoryItem[];
}

const BATCH_STATUSES = ['QUEUING', 'QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'];
const ITEM_STATUSES = ['PENDING', 'QUEUED', 'RUNNING', 'SUCCESS', 'SKIPPED', 'FAILED', 'UNCERTAIN'];
const ACTIVE_BATCH = ['QUEUING', 'QUEUED', 'RUNNING'];

function statusTone(status: string): StatusTone {
    if (status === 'SUCCESS' || status === 'COMPLETED') return 'success';
    if (status === 'FAILED') return 'danger';
    if (status === 'UNCERTAIN' || status === 'PARTIAL') return 'warning';
    if (status === 'RUNNING' || status === 'QUEUED' || status === 'QUEUING') return 'info';
    return 'neutral';
}

function batchStatusLabel(status: string, t: TFunction) {
    return BATCH_STATUSES.includes(status) ? t(`syncHistory.batches.statuses.${status}`) : status;
}

function itemStatusLabel(status: string, t: TFunction) {
    return ITEM_STATUSES.includes(status) ? t(`syncHistory.items.${status}`) : status;
}

function finishedCount(counts: Counts): number {
    return (counts.SUCCESS ?? 0) + (counts.SKIPPED ?? 0) + (counts.FAILED ?? 0) + (counts.UNCERTAIN ?? 0);
}

function SyncProgress({ counts, total, active }: { counts: Counts; total: number; active: boolean }) {
    const { t } = useTranslation();
    const done = finishedCount(counts);
    const percentage = total > 0 ? Math.min(100, (done / total) * 100) : 100;

    return (
        <div className="min-w-36 space-y-1.5">
            <div className="flex justify-between gap-2 text-xs">
                <span className="tabular-nums text-muted-foreground">
                    {t('syncHistory.batches.progress', { done: formatNumber(done), total: formatNumber(total) })}
                </span>
                <span className="flex items-center gap-1 font-semibold tabular-nums">
                    {active && <Loader2 aria-hidden="true" className="size-3 animate-spin text-primary" />}
                    {Math.floor(percentage)}%
                </span>
            </div>
            <Progress value={percentage} className="h-2" />
        </div>
    );
}

/** Qolgan vaqtni taxminlash: hozirgacha bo‘lgan o‘rtacha tezlik asosida. */
function estimateRemaining(batch: Batch, counts: Counts, t: TFunction): string | null {
    if (!ACTIVE_BATCH.includes(batch.status)) return null;
    const done = finishedCount(counts);
    const remaining = batch.totalItems - done;
    const elapsedMs = Date.now() - new Date(batch.createdAt).getTime();
    if (done < 3 || remaining <= 0 || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;

    const minutes = Math.max(1, Math.round((remaining * elapsedMs) / done / 60_000));
    const value = minutes < 60
        ? t('syncHistory.batch.etaMinutes', { count: minutes })
        : t('syncHistory.batch.etaHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
    return t('syncHistory.batch.eta', { value });
}

function BatchDetails({ batchId, onBack }: { batchId: string; onBack: () => void }) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');

    const { data, loading, refreshing, error, retry } = useApiQuery<DetailResponse>(
        `/person-sync-queue/history/${batchId}?page=${page}&limit=20${status !== 'ALL' ? `&status=${status}` : ''}`,
    );
    const active = data ? ACTIVE_BATCH.includes(data.batch.status) : true;
    useInterval(retry, active ? 10_000 : null);

    const eta = data ? estimateRemaining(data.batch, data.counts, t) : null;

    return (
        <div className="min-w-0 space-y-5">
            <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
                <ArrowLeft aria-hidden="true" />
                {t('syncHistory.batch.back')}
            </Button>

            {loading ? (
                <LoadingState rows={6} />
            ) : error || !data ? (
                <ErrorState message={error || t('syncHistory.common.loadFailed')} onRetry={retry} />
            ) : (
                <>
                    <Card className="gap-4 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="font-heading text-xl font-bold">
                                    {t('syncHistory.batches.task', { id: data.batch.id })}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {t(`syncHistory.batches.types.${data.batch.type}`)} ·{' '}
                                    {t('syncHistory.batches.terminalsCount', { count: data.batch.terminalCount })}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {t('syncHistory.batch.createdAt', { date: formatDateTime(data.batch.createdAt) })}
                                    {data.batch.finishedAt && (
                                        <> · {t('syncHistory.batch.finishedAt', { date: formatDateTime(data.batch.finishedAt) })}</>
                                    )}
                                </p>
                            </div>
                            <StatusBadge tone={statusTone(data.batch.status)}>
                                {batchStatusLabel(data.batch.status, t)}
                            </StatusBadge>
                        </div>
                        <SyncProgress counts={data.counts} total={data.batch.totalItems} active={active} />
                        {eta && <p className="text-xs text-muted-foreground">{eta}</p>}
                    </Card>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <KpiCard label={t('syncHistory.items.SUCCESS')} value={data.counts.SUCCESS ?? 0} icon={CheckCircle2} tone="success" />
                        <KpiCard label={t('syncHistory.items.SKIPPED')} value={data.counts.SKIPPED ?? 0} icon={SkipForward} tone="neutral" />
                        <KpiCard label={t('syncHistory.items.FAILED')} value={data.counts.FAILED ?? 0} icon={XCircle} tone="danger" />
                        <KpiCard label={t('syncHistory.items.UNCERTAIN')} value={data.counts.UNCERTAIN ?? 0} icon={AlertTriangle} tone="warning" />
                    </div>

                    <Card className="min-w-0 gap-0 py-0">
                        <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-muted/20 p-4">
                            <h3 className="flex items-center gap-2 font-semibold">
                                <Users aria-hidden="true" className="size-5 text-primary" />
                                {t('syncHistory.batch.persons')}
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                                    {formatNumber(data.batch.totalItems)}
                                </span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="w-48">
                                    <SelectField
                                        value={status}
                                        onValueChange={(value) => {
                                            setStatus(value);
                                            setPage(1);
                                        }}
                                        options={[
                                            { value: 'ALL', label: t('syncHistory.filters.all') },
                                            ...ITEM_STATUSES.map((value) => ({
                                                value,
                                                label: `${t(`syncHistory.items.${value}`)} (${formatNumber(data.counts[value] ?? 0)})`,
                                            })),
                                        ]}
                                        aria-label={t('syncHistory.filters.status')}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={retry}
                                    disabled={refreshing}
                                    aria-label={t('common.refresh')}
                                    title={t('common.refresh')}
                                >
                                    <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 p-4">
                            {data.items.length === 0 ? (
                                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    {t('syncHistory.batch.emptyItems')}
                                </p>
                            ) : (
                                <>
                                    <div className="hidden overflow-x-auto rounded-xl border lg:block">
                                        <table className="w-full min-w-[820px] text-sm">
                                            <thead className="border-b bg-muted/50 text-left">
                                                <tr className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                                    {(['person', 'terminal', 'status', 'attempts', 'error', 'time'] as const).map((key) => (
                                                        <th key={key} className="px-3 py-2.5">{t(`syncHistory.batch.columns.${key}`)}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {data.items.map((item) => (
                                                    <tr key={item.id} className="align-top hover:bg-muted/30">
                                                        <td className="px-3 py-3">
                                                            <div className="max-w-60 truncate font-semibold" title={item.personName ?? undefined}>
                                                                {item.personName ?? '—'}
                                                            </div>
                                                            <div className="font-mono text-xs text-muted-foreground">
                                                                {t('syncHistory.batch.personId', { id: item.personId })}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="max-w-48 truncate">{item.terminalName ?? t('syncHistory.common.terminal')}</div>
                                                            <div className="font-mono text-xs text-muted-foreground">#{item.terminalId}</div>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <StatusBadge tone={statusTone(item.status)}>{itemStatusLabel(item.status, t)}</StatusBadge>
                                                        </td>
                                                        <td className="px-3 py-3 tabular-nums">{item.attempts}</td>
                                                        <td className="max-w-40 px-3 py-3 text-xs break-all text-destructive">{item.errorCode ?? '—'}</td>
                                                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                            <div>{formatDateTime(item.startedAt, '—')}</div>
                                                            <div className="text-muted-foreground">→ {formatDateTime(item.finishedAt, '—')}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                                        {data.items.map((item) => (
                                            <li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold">{item.personName ?? '—'}</p>
                                                        <p className="font-mono text-xs text-muted-foreground">
                                                            {t('syncHistory.batch.personId', { id: item.personId })}
                                                        </p>
                                                    </div>
                                                    <StatusBadge tone={statusTone(item.status)}>{itemStatusLabel(item.status, t)}</StatusBadge>
                                                </div>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {item.terminalName ?? t('syncHistory.common.terminal')} · #{item.terminalId} ·{' '}
                                                    {t('syncHistory.batch.attempts', { count: item.attempts })}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(item.startedAt, '—')} → {formatDateTime(item.finishedAt, '—')}
                                                </p>
                                                {item.errorCode && (
                                                    <p className="rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs break-words text-destructive">
                                                        {item.errorCode}
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            <Pagination
                                page={data.pagination.page}
                                totalPages={Math.max(1, data.pagination.totalPages)}
                                total={data.pagination.totalItems}
                                pageSize={data.pagination.limit}
                                shownCount={data.items.length}
                                onPageChange={setPage}
                            />
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

export function PersonSyncHistoryPage({ embedded = false }: { embedded?: boolean }) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [terminalInput, setTerminalInput] = useState('');
    const [terminalId, setTerminalId] = useState('');
    const [filterError, setFilterError] = useState('');

    // Ochilgan topshiriq URL’da saqlanadi (?tab=persons&batch=48):
    // sahifa yangilansa, tab almashtirilsa yoki havola ulashilsa ham
    // o‘sha topshiriq ochiladi; brauzerning «Orqaga» tugmasi ishlaydi.
    const [searchParams, setSearchParams] = useSearchParams();
    const batchParam = searchParams.get('batch');
    const selectedBatchId = batchParam && /^[1-9]\d*$/.test(batchParam) ? batchParam : null;

    function setSelectedBatchId(batchId: string | null) {
        setSearchParams(
            (previous) => {
                const next = new URLSearchParams(previous);
                if (batchId) next.set('batch', batchId);
                else next.delete('batch');
                return next;
            },
            { replace: false },
        );
    }

    const params = new URLSearchParams({ page: String(page), limit: '20', status });
    if (terminalId) params.set('terminalId', terminalId);

    const { data, loading, refreshing, error, retry } = useApiQuery<HistoryResponse>(
        `/person-sync-queue/history?${params.toString()}`,
    );
    useInterval(retry, selectedBatchId ? null : 15_000);

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

    if (selectedBatchId) {
        return <BatchDetails key={selectedBatchId} batchId={selectedBatchId} onBack={() => setSelectedBatchId(null)} />;
    }

    const batches = data?.batches ?? [];
    const activeOnPage = batches.filter((batch) => ACTIVE_BATCH.includes(batch.status)).length;
    const hasFilters = status !== 'ALL' || Boolean(terminalId);

    return (
        <div className="min-w-0 space-y-5">
            {!embedded && (
                <PageHeader
                    eyebrow={t('terminals.eyebrow')}
                    title={t('syncHistory.batches.title')}
                    description={t('syncHistory.batches.hint')}
                />
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t('syncHistory.batches.title')} value={data?.pagination.totalItems ?? 0} icon={ListChecks} loading={loading} />
                <KpiCard
                    label={t('syncHistory.batches.statuses.RUNNING')}
                    value={activeOnPage}
                    hint={t('syncHistory.events.onPage')}
                    icon={Loader2}
                    tone="primary"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.batches.statuses.COMPLETED')}
                    value={batches.filter((batch) => batch.status === 'COMPLETED').length}
                    hint={t('syncHistory.events.onPage')}
                    icon={CheckCircle2}
                    tone="success"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.batches.problems')}
                    value={batches.reduce((sum, batch) => sum + (batch.counts.FAILED ?? 0) + (batch.counts.UNCERTAIN ?? 0), 0)}
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
                                    ...BATCH_STATUSES.map((value) => ({ value, label: batchStatusLabel(value, t) })),
                                ]}
                                aria-label={t('syncHistory.filters.status')}
                            />
                        </Field>
                        <Field htmlFor="person-history-terminal" label={t('syncHistory.filters.terminalId')}>
                            <Input
                                id="person-history-terminal"
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
                    title={t('syncHistory.batches.title')}
                    hint={t('syncHistory.batches.hint')}
                    total={data?.pagination.totalItems}
                    refreshing={refreshing}
                    onRefresh={retry}
                />

                <div className="space-y-4 p-4">
                    {loading ? (
                        <LoadingState rows={5} className="border-0 p-0 sm:p-0" />
                    ) : error || !data ? (
                        <ErrorState message={error || t('syncHistory.common.loadFailed')} onRetry={retry} />
                    ) : batches.length === 0 ? (
                        <EmptyState
                            icon={ListChecks}
                            title={t('syncHistory.batches.emptyTitle')}
                            description={t('syncHistory.batches.empty')}
                        />
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto rounded-xl border lg:block">
                                <table className="w-full min-w-[880px] text-sm">
                                    <thead className="border-b bg-muted/50 text-left">
                                        <tr className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                            {(['task', 'createdAt', 'type', 'terminals', 'status', 'progress'] as const).map((key) => (
                                                <th key={key} className="px-3 py-2.5">{t(`syncHistory.batches.columns.${key}`)}</th>
                                            ))}
                                            <th className="px-3 py-2.5 text-right">{t('syncHistory.batches.columns.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {batches.map((batch) => (
                                            <tr key={batch.id} className="align-middle hover:bg-muted/30">
                                                <td className="px-3 py-3 font-mono font-semibold">#{batch.id}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(batch.createdAt, '—')}</td>
                                                <td className="px-3 py-3">{t(`syncHistory.batches.types.${batch.type}`)}</td>
                                                <td className="px-3 py-3 tabular-nums">{batch.terminalCount}</td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge tone={statusTone(batch.status)}>{batchStatusLabel(batch.status, t)}</StatusBadge>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <SyncProgress
                                                        counts={batch.counts}
                                                        total={batch.totalItems}
                                                        active={ACTIVE_BATCH.includes(batch.status)}
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedBatchId(batch.id)}>
                                                        <Eye aria-hidden="true" />
                                                        {t('syncHistory.batches.details')}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                                {batches.map((batch) => (
                                    <li key={batch.id} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-heading font-bold">{t('syncHistory.batches.task', { id: batch.id })}</p>
                                                <p className="text-xs text-muted-foreground">{formatDateTime(batch.createdAt, '—')}</p>
                                            </div>
                                            <StatusBadge tone={statusTone(batch.status)}>{batchStatusLabel(batch.status, t)}</StatusBadge>
                                        </div>
                                        <p className="text-sm">
                                            {t(`syncHistory.batches.types.${batch.type}`)}
                                            <span className="text-muted-foreground"> · {t('syncHistory.batches.terminalsCount', { count: batch.terminalCount })}</span>
                                        </p>
                                        <SyncProgress counts={batch.counts} total={batch.totalItems} active={ACTIVE_BATCH.includes(batch.status)} />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-auto"
                                            onClick={() => setSelectedBatchId(batch.id)}
                                        >
                                            <Eye aria-hidden="true" />
                                            {t('syncHistory.batches.details')}
                                        </Button>
                                    </li>
                                ))}
                            </ul>

                            <Pagination
                                page={data.pagination.page}
                                totalPages={Math.max(1, data.pagination.totalPages)}
                                total={data.pagination.totalItems}
                                pageSize={data.pagination.limit}
                                shownCount={batches.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
