import { useState } from 'react';
import { Activity, AlertTriangle, Unplug, DownloadCloud, History, PauseCircle, RadioTower, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { formatDateTime, formatNumber, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';

type Source = 'PUSH' | 'AUTO_PULL' | 'MANUAL_PULL';
type TerminalStatus = 'REALTIME' | 'LAGGING' | 'IDLE' | 'NEVER';

interface ActivityRow {
    terminalId: number;
    terminalName: string | null;
    schoolName: string | null;
    source: Source;
    hourStart: string;
    received: number;
    inserted: number;
    duplicates: number;
    withPicture: number;
    withoutPicture: number;
    maxLagSeconds: number;
    runs: number;
}

interface ActivityResponse {
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
    items: ActivityRow[];
}

interface Summary {
    aborted: { total: number; terminals: number; top: { id: number; name: string; schoolName: string | null; count: number }[] };
    terminals: { total: number; realtime: number; lagging: number; idle: number; never: number };
    attention: {
        id: number;
        name: string;
        schoolName: string | null;
        status: TerminalStatus;
        lastReceivedAt: string | null;
        lastEventAt: string | null;
        lagMinutes: number | null;
    }[];
    today: { source: Source; received: number; inserted: number; duplicates: number; withPicture: number; withoutPicture: number; maxLagSeconds: number }[];
}

const SOURCE_TONE: Record<Source, StatusTone> = { PUSH: 'info', AUTO_PULL: 'warning', MANUAL_PULL: 'primary' };
const STATUS_TONE: Record<TerminalStatus, StatusTone> = { REALTIME: 'success', LAGGING: 'warning', IDLE: 'danger', NEVER: 'neutral' };
const PAGE_SIZE = 20;

function useLagText() {
    const { t } = useTranslation();
    return (seconds: number) => {
        const minutes = Math.round(seconds / 60);
        if (minutes < 2) return t('syncHistory.push.realtime');
        if (minutes < 60) return t('syncHistory.push.lagM', { m: minutes });
        return t('syncHistory.push.lagHm', { h: Math.floor(minutes / 60), m: minutes % 60 });
    };
}

export function PushActivitySection() {
    const { t } = useTranslation();
    const lagText = useLagText();
    const [page, setPage] = useState(1);
    const [source, setSource] = useState<'ALL' | Source>('ALL');
    const [terminalInput, setTerminalInput] = useState('');
    const [dateFromInput, setDateFromInput] = useState('');
    const [dateToInput, setDateToInput] = useState('');
    const [applied, setApplied] = useState({ terminalId: '', dateFrom: '', dateTo: '' });
    const [filterError, setFilterError] = useState('');
    const today = todayInTashkent();

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), source });
    if (applied.terminalId) params.set('terminalId', applied.terminalId);
    if (applied.dateFrom) params.set('dateFrom', applied.dateFrom);
    if (applied.dateTo) params.set('dateTo', applied.dateTo);

    const summary = useApiQuery<Summary>('/terminal-event-activity/summary');
    const list = useApiQuery<ActivityResponse>(`/terminal-event-activity?${params.toString()}`);
    useInterval(() => {
        summary.retry();
        list.retry();
    }, 15_000);

    const push = summary.data?.today.find((item) => item.source === 'PUSH');
    const hasFilters = source !== 'ALL' || Boolean(applied.terminalId || applied.dateFrom || applied.dateTo);

    function apply() {
        const id = terminalInput.trim();
        if (id && !/^[1-9]\d*$/.test(id)) return setFilterError(t('syncHistory.filters.invalidTerminal'));
        if (dateFromInput && dateToInput && dateFromInput > dateToInput) return setFilterError(t('syncHistory.filters.invalidRange'));
        setFilterError('');
        setApplied({ terminalId: id, dateFrom: dateFromInput, dateTo: dateToInput });
        setPage(1);
    }

    function reset() {
        setSource('ALL');
        setTerminalInput('');
        setDateFromInput('');
        setDateToInput('');
        setApplied({ terminalId: '', dateFrom: '', dateTo: '' });
        setFilterError('');
        setPage(1);
    }

    const items = list.data?.items ?? [];

    return (
        <section className="min-w-0 space-y-5">
            <p className="text-sm text-muted-foreground">{t('syncHistory.push.description')}</p>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <KpiCard label={t('syncHistory.push.kpi.total')} value={summary.data?.terminals.total ?? 0} icon={RadioTower} loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.realtime')} value={summary.data?.terminals.realtime ?? 0} icon={Activity} tone="success" loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.lagging')} value={summary.data?.terminals.lagging ?? 0} icon={AlertTriangle} tone="warning" loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.idle')} value={summary.data?.terminals.idle ?? 0} icon={PauseCircle} tone="danger" loading={summary.loading} />
                <KpiCard
                    label={t('syncHistory.push.kpi.today')}
                    value={formatNumber(push?.received ?? 0)}
                    hint={t('syncHistory.push.kpi.todayNew', { count: formatNumber(push?.inserted ?? 0) })}
                    icon={DownloadCloud}
                    loading={summary.loading}
                />
            </div>

            {summary.data && summary.data.attention.length > 0 && (
                <Card className="gap-0 py-0">
                    <div className="border-b p-4">
                        <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                            <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
                            {t('syncHistory.push.attention.title')}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t('syncHistory.push.attention.hint')}</p>
                    </div>
                    <ul className="list-none divide-y">
                        {summary.data.attention.map((terminal) => (
                            <li key={terminal.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                <span className="min-w-0">
                                    <span className="font-semibold">{terminal.name}</span>
                                    <span className="text-xs text-muted-foreground"> · #{terminal.id}{terminal.schoolName ? ` · ${terminal.schoolName}` : ''}</span>
                                </span>
                                <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                                    {terminal.status === 'LAGGING' && terminal.lagMinutes !== null && (
                                        <span>{t('syncHistory.push.attention.behind', { value: lagText(terminal.lagMinutes * 60) })}</span>
                                    )}
                                    <span>{t('syncHistory.push.attention.lastRequest', { value: formatDateTime(terminal.lastReceivedAt) })}</span>
                                    <StatusBadge tone={STATUS_TONE[terminal.status]}>{t(`syncHistory.push.status.${terminal.status}`)}</StatusBadge>
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {summary.data && summary.data.aborted.total > 0 && (
                <Card className="gap-0 py-0">
                    <div className="border-b p-4">
                        <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                            <Unplug aria-hidden="true" className="size-4 text-warning" />
                            {t('syncHistory.push.aborted.title')}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {t('syncHistory.push.aborted.hint', {
                                total: formatNumber(summary.data.aborted.total),
                                terminals: formatNumber(summary.data.aborted.terminals),
                            })}
                        </p>
                    </div>
                    <ul className="list-none divide-y">
                        {summary.data.aborted.top.map((terminal) => (
                            <li key={terminal.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                <span className="min-w-0">
                                    <span className="font-semibold">{terminal.name}</span>
                                    <span className="text-xs text-muted-foreground"> · #{terminal.id}{terminal.schoolName ? ` · ${terminal.schoolName}` : ''}</span>
                                </span>
                                <StatusBadge tone={terminal.count >= 50 ? 'danger' : 'warning'}>
                                    {t('syncHistory.push.aborted.count', { count: terminal.count })}
                                </StatusBadge>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card className="min-w-0 gap-0 py-0">
                <form
                    className="space-y-3 border-b bg-muted/20 p-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
                        <Field label={t('syncHistory.push.filters.source')}>
                            <SelectField
                                value={source}
                                onValueChange={(value) => {
                                    setSource(value as 'ALL' | Source);
                                    setPage(1);
                                }}
                                options={[
                                    { value: 'ALL', label: t('syncHistory.filters.all') },
                                    { value: 'PUSH', label: t('syncHistory.push.source.PUSH') },
                                    { value: 'AUTO_PULL', label: t('syncHistory.push.source.AUTO_PULL') },
                                    { value: 'MANUAL_PULL', label: t('syncHistory.push.source.MANUAL_PULL') },
                                ]}
                                aria-label={t('syncHistory.push.filters.source')}
                            />
                        </Field>
                        <Field htmlFor="push-activity-terminal" label={t('syncHistory.filters.terminalId')}>
                            <Input
                                id="push-activity-terminal"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                value={terminalInput}
                                onChange={(event) => setTerminalInput(event.target.value)}
                                placeholder={t('syncHistory.filters.terminalPlaceholder')}
                                className="bg-background"
                            />
                        </Field>
                        <Field htmlFor="push-activity-from" label={t('syncHistory.filters.dateFrom')}>
                            <Input id="push-activity-from" type="date" max={today} value={dateFromInput} onChange={(event) => setDateFromInput(event.target.value)} className="bg-background" />
                        </Field>
                        <Field htmlFor="push-activity-to" label={t('syncHistory.filters.dateTo')}>
                            <Input id="push-activity-to" type="date" max={today} value={dateToInput} onChange={(event) => setDateToInput(event.target.value)} className="bg-background" />
                        </Field>
                        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                            <Button type="submit" className="flex-1 lg:flex-none">
                                {t('syncHistory.filters.apply')}
                            </Button>
                            {hasFilters && (
                                <Button type="button" variant="ghost" onClick={reset}>
                                    <X aria-hidden="true" />
                                    {t('syncHistory.filters.reset')}
                                </Button>
                            )}
                        </div>
                    </div>
                    {filterError && (
                        <p role="alert" className="text-sm text-destructive">
                            {filterError}
                        </p>
                    )}
                </form>

                <div className="flex items-start justify-between gap-3 border-b p-4">
                    <div>
                        <h2 className="font-heading text-base font-bold">{t('syncHistory.push.table.title')}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t('syncHistory.push.table.hint')}</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={list.retry} disabled={list.refreshing} aria-label={t('common.refresh')} title={t('common.refresh')}>
                        <RefreshCw aria-hidden="true" className={cn(list.refreshing && 'animate-spin')} />
                    </Button>
                </div>

                <div className="space-y-4 p-4">
                    {list.loading ? (
                        <LoadingState rows={6} className="border-0 p-0 sm:p-0" />
                    ) : list.error || !list.data ? (
                        <ErrorState message={list.error || t('syncHistory.common.loadFailed')} onRetry={list.retry} />
                    ) : items.length === 0 ? (
                        <EmptyState icon={History} title={t('syncHistory.push.table.emptyTitle')} description={t('syncHistory.push.table.empty')} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px] text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">{t('syncHistory.push.table.hour')}</th>
                                            <th className="py-2 pr-3 font-medium">{t('syncHistory.push.table.terminal')}</th>
                                            <th className="py-2 pr-3 font-medium">{t('syncHistory.push.table.source')}</th>
                                            <th className="py-2 pr-3 text-right font-medium">{t('syncHistory.push.table.received')}</th>
                                            <th className="py-2 pr-3 text-right font-medium">{t('syncHistory.push.table.inserted')}</th>
                                            <th className="py-2 pr-3 text-right font-medium">{t('syncHistory.push.table.duplicates')}</th>
                                            <th className="py-2 pr-3 text-right font-medium">{t('syncHistory.push.table.photos')}</th>
                                            <th className="py-2 font-medium">{t('syncHistory.push.table.lag')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="tabular-nums">
                                        {items.map((row) => (
                                            <tr key={`${row.terminalId}-${row.source}-${row.hourStart}`} className="border-t">
                                                <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(row.hourStart).slice(0, 17)}</td>
                                                <td className="py-2 pr-3">
                                                    <span className="font-medium">{row.terminalName ?? `#${row.terminalId}`}</span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        #{row.terminalId}
                                                        {row.schoolName ? ` · ${row.schoolName}` : ''}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-3">
                                                    <StatusBadge tone={SOURCE_TONE[row.source]} dot={false}>
                                                        {t(`syncHistory.push.source.${row.source}`)}
                                                    </StatusBadge>
                                                    {row.source !== 'PUSH' && row.runs > 0 && (
                                                        <span className="ml-1 text-xs text-muted-foreground">×{row.runs}</span>
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3 text-right">{formatNumber(row.received)}</td>
                                                <td className="py-2 pr-3 text-right font-semibold">{formatNumber(row.inserted)}</td>
                                                <td className="py-2 pr-3 text-right text-muted-foreground">{formatNumber(row.duplicates)}</td>
                                                <td className="py-2 pr-3 text-right">
                                                    {formatNumber(row.withPicture)}
                                                    <span className="text-muted-foreground"> / {formatNumber(row.withoutPicture)}</span>
                                                </td>
                                                <td className="py-2">{row.source === 'PUSH' ? lagText(row.maxLagSeconds) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                page={list.data.pagination.page}
                                totalPages={list.data.pagination.totalPages}
                                onPageChange={setPage}
                                total={list.data.pagination.totalItems}
                                pageSize={list.data.pagination.limit}
                                shownCount={items.length}
                                label={t('syncHistory.push.table.title')}
                            />
                        </>
                    )}
                </div>
            </Card>
        </section>
    );
}
