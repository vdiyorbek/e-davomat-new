import { useState } from 'react';
import { Clock3, DownloadCloud, History, RefreshCw, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, formatNumber, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';

interface EventRun {
    id: string;
    terminalId: number;
    terminalName: string | null;
    status: 'SUCCESS' | 'FAILED';
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    cursorBefore: string | null;
    cursorAfter: string | null;
    errorCode: string | null;
    fetchedEvents?: number;
    insertedEvents?: number;
}

interface HistoryResponse {
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
    items: EventRun[];
}

type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILED';

const PAGE_SIZE = 20;

function isValidTerminalId(value: string) {
    return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 4294967295;
}

export function EventSyncHistorySection() {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<StatusFilter>('ALL');
    const [terminalInput, setTerminalInput] = useState('');
    const [dateFromInput, setDateFromInput] = useState('');
    const [dateToInput, setDateToInput] = useState('');
    const [applied, setApplied] = useState({ terminalId: '', dateFrom: '', dateTo: '' });
    const [filterError, setFilterError] = useState('');

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), status });
    if (applied.terminalId) params.set('terminalId', applied.terminalId);
    if (applied.dateFrom) params.set('dateFrom', applied.dateFrom);
    if (applied.dateTo) params.set('dateTo', applied.dateTo);

    const { data, loading, error, retry, refreshing } = useApiQuery<HistoryResponse>(
        `/terminal-sync-monitoring/history?${params.toString()}`,
    );
    useInterval(retry, 15_000);

    const hasFilters = Boolean(status !== 'ALL' || applied.terminalId || applied.dateFrom || applied.dateTo);

    function applyFilters() {
        const id = terminalInput.trim();
        if (id && !isValidTerminalId(id)) {
            setFilterError(t('syncHistory.filters.invalidTerminal'));
            return;
        }
        if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
            setFilterError(t('syncHistory.filters.invalidRange'));
            return;
        }
        setFilterError('');
        setApplied({ terminalId: id, dateFrom: dateFromInput, dateTo: dateToInput });
        setPage(1);
    }

    function resetFilters() {
        setStatus('ALL');
        setTerminalInput('');
        setDateFromInput('');
        setDateToInput('');
        setApplied({ terminalId: '', dateFrom: '', dateTo: '' });
        setFilterError('');
        setPage(1);
    }

    const items = data?.items ?? [];
    const successCount = items.filter((item) => item.status === 'SUCCESS').length;
    const newEventsOnPage = items.reduce((sum, item) => sum + (item.insertedEvents ?? 0), 0);
    const avgSeconds = items.length
        ? items.reduce((sum, item) => sum + item.durationMs, 0) / items.length / 1000
        : 0;

    const statusLabel = (value: EventRun['status']) => t(`syncHistory.events.statuses.${value}`);
    const today = todayInTashkent();

    return (
        <section className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t('syncHistory.events.title')} value={data?.pagination.totalItems ?? 0} icon={History} loading={loading} />
                <KpiCard
                    label={t('syncHistory.events.newEvents')}
                    value={newEventsOnPage}
                    hint={t('syncHistory.events.onPage')}
                    icon={DownloadCloud}
                    tone="success"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.events.failed')}
                    value={items.length - successCount}
                    hint={t('syncHistory.events.onPage')}
                    icon={XCircle}
                    tone="danger"
                    loading={loading}
                />
                <KpiCard
                    label={t('syncHistory.events.avgDuration')}
                    value={t('syncHistory.common.seconds', { value: avgSeconds.toFixed(1) })}
                    hint={t('syncHistory.events.onPage')}
                    icon={Clock3}
                    tone="warning"
                    loading={loading}
                />
            </div>

            <Card className="min-w-0 gap-0 py-0">
                <form
                    className="space-y-3 border-b bg-muted/20 p-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        applyFilters();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
                        <Field label={t('syncHistory.filters.status')}>
                            <SelectField
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value as StatusFilter);
                                    setPage(1);
                                }}
                                options={[
                                    { value: 'ALL', label: t('syncHistory.filters.all') },
                                    { value: 'SUCCESS', label: statusLabel('SUCCESS') },
                                    { value: 'FAILED', label: statusLabel('FAILED') },
                                ]}
                                aria-label={t('syncHistory.filters.status')}
                            />
                        </Field>
                        <Field htmlFor="event-history-terminal" label={t('syncHistory.filters.terminalId')}>
                            <Input
                                id="event-history-terminal"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                value={terminalInput}
                                onChange={(event) => setTerminalInput(event.target.value)}
                                placeholder={t('syncHistory.filters.terminalPlaceholder')}
                                className="bg-background"
                            />
                        </Field>
                        <Field htmlFor="event-history-from" label={t('syncHistory.filters.dateFrom')}>
                            <Input
                                id="event-history-from"
                                type="date"
                                max={today}
                                value={dateFromInput}
                                onChange={(event) => setDateFromInput(event.target.value)}
                                className="bg-background"
                            />
                        </Field>
                        <Field htmlFor="event-history-to" label={t('syncHistory.filters.dateTo')}>
                            <Input
                                id="event-history-to"
                                type="date"
                                max={today}
                                value={dateToInput}
                                onChange={(event) => setDateToInput(event.target.value)}
                                className="bg-background"
                            />
                        </Field>
                        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                            <Button type="submit" className="flex-1 lg:flex-none">
                                {t('syncHistory.filters.apply')}
                            </Button>
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
                    title={t('syncHistory.events.title')}
                    hint={t('syncHistory.events.hint')}
                    total={data?.pagination.totalItems}
                    refreshing={refreshing}
                    onRefresh={retry}
                />

                <div className="space-y-4 p-4">
                    {loading ? (
                        <LoadingState rows={6} className="border-0 p-0 sm:p-0" />
                    ) : error || !data ? (
                        <ErrorState message={error || t('syncHistory.common.loadFailed')} onRetry={retry} />
                    ) : items.length === 0 ? (
                        <EmptyState
                            icon={History}
                            title={t('syncHistory.events.emptyTitle')}
                            description={t('syncHistory.events.empty')}
                        />
                    ) : (
                        <>
                            {/* Kompyuter: jadval */}
                            <div className="hidden overflow-x-auto rounded-xl border lg:block">
                                <table className="w-full min-w-[880px] text-sm">
                                    <thead className="border-b bg-muted/50 text-left">
                                        <tr className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.terminal')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.status')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.startedAt')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.duration')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.events')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.cursorAfter')}</th>
                                            <th className="px-3 py-2.5">{t('syncHistory.events.columns.error')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {items.map((item) => (
                                            <tr key={item.id} className="align-top hover:bg-muted/30">
                                                <td className="px-3 py-3">
                                                    <div className="max-w-56 truncate font-semibold" title={item.terminalName ?? undefined}>
                                                        {item.terminalName ?? t('syncHistory.common.terminal')}
                                                    </div>
                                                    <div className="font-mono text-xs text-muted-foreground">#{item.terminalId}</div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge tone={item.status === 'SUCCESS' ? 'success' : 'danger'}>
                                                        {statusLabel(item.status)}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(item.startedAt)}</td>
                                                <td className="px-3 py-3 tabular-nums">
                                                    {t('syncHistory.common.seconds', { value: (item.durationMs / 1000).toFixed(1) })}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                                                    <EventCounts item={item} />
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div>{formatDateTime(item.cursorAfter)}</div>
                                                    <div className="text-xs text-muted-foreground">← {formatDateTime(item.cursorBefore)}</div>
                                                </td>
                                                <td className="max-w-48 px-3 py-3 text-xs break-words text-destructive">{item.errorCode ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Telefon va planshet: kartalar */}
                            <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                                {items.map((item) => (
                                    <li key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-heading font-bold">
                                                    {item.terminalName ?? t('syncHistory.common.terminal')}
                                                </p>
                                                <p className="font-mono text-xs text-muted-foreground">#{item.terminalId}</p>
                                            </div>
                                            <StatusBadge tone={item.status === 'SUCCESS' ? 'success' : 'danger'}>
                                                {statusLabel(item.status)}
                                            </StatusBadge>
                                        </div>
                                        <dl className="grid grid-cols-3 divide-x rounded-lg border bg-muted/30 text-center">
                                            <div className="min-w-0 px-2 py-2">
                                                <dt className="truncate text-[11px] text-muted-foreground">{t('syncHistory.events.columns.startedAt')}</dt>
                                                <dd className="truncate text-sm font-semibold">{formatDateTime(item.startedAt)}</dd>
                                            </div>
                                            <div className="min-w-0 px-2 py-2">
                                                <dt className="truncate text-[11px] text-muted-foreground">{t('syncHistory.events.columns.duration')}</dt>
                                                <dd className="text-sm font-semibold tabular-nums">
                                                    {t('syncHistory.common.seconds', { value: (item.durationMs / 1000).toFixed(1) })}
                                                </dd>
                                            </div>
                                            <div className="min-w-0 px-2 py-2">
                                                <dt className="truncate text-[11px] text-muted-foreground">{t('syncHistory.events.columns.events')}</dt>
                                                <dd className="text-sm font-semibold tabular-nums">
                                                    <EventCounts item={item} compact />
                                                </dd>
                                            </div>
                                        </dl>
                                        <p className="text-xs break-words text-muted-foreground">
                                            {t('syncHistory.events.cursor', {
                                                from: formatDateTime(item.cursorBefore),
                                                to: formatDateTime(item.cursorAfter),
                                            })}
                                        </p>
                                        {item.errorCode && (
                                            <p className="rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs break-words text-destructive">
                                                {item.errorCode}
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
                                shownCount={items.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </div>
            </Card>
        </section>
    );
}

/** «12 yangi / 40» — yangi saqlangan va terminaldan olingan eventlar. */
function EventCounts({ item, compact = false }: { item: EventRun; compact?: boolean }) {
    const { t } = useTranslation();
    if (item.fetchedEvents === undefined) return <span className="text-muted-foreground">—</span>;
    const inserted = item.insertedEvents ?? 0;
    if (compact) {
        return <span className={cn(inserted > 0 && 'text-success')}>+{formatNumber(inserted)}</span>;
    }
    return (
        <span className={cn(inserted > 0 ? 'font-semibold text-success' : 'text-muted-foreground')}>
            {t('syncHistory.events.newOfFetched', {
                inserted: formatNumber(inserted),
                fetched: formatNumber(item.fetchedEvents),
            })}
        </span>
    );
}

/** Ro‘yxat sarlavhasi: nom, izoh, jami soni va yangilash tugmasi. */
export function ListHeader({
    title,
    hint,
    total,
    refreshing,
    onRefresh,
}: {
    title: string;
    hint: string;
    total?: number;
    refreshing: boolean;
    onRefresh: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                    <History aria-hidden="true" className="size-5 text-primary" />
                    {title}
                    {total !== undefined && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-xs font-semibold tabular-nums text-muted-foreground">
                            {formatNumber(total)}
                        </span>
                    )}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                    <span
                        aria-hidden="true"
                        className={cn('size-1.5 rounded-full', refreshing ? 'animate-pulse bg-primary' : 'bg-success')}
                    />
                    {refreshing ? t('syncHistory.common.refreshing') : t('syncHistory.common.autoRefresh')}
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
            >
                <RefreshCw aria-hidden="true" className={cn(refreshing && 'animate-spin')} />
            </Button>
        </div>
    );
}
