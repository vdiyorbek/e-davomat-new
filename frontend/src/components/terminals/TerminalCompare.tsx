import { useState } from 'react';
import { Download, GitCompareArrows, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedPost } from '@/lib/auth-session';
import { formatDateTime, formatNumber } from '@/lib/date';

import { StatTile } from './StatTile';

interface CompareState {
    status: 'running' | 'done' | 'failed';
    startedAt: string;
    loaded: number;
    total: number | null;
    error: string | null;
}

interface CompareResult {
    comparedAt: string;
    databasePersons: number;
    terminalPersons: number;
    matched: number;
    missingOnTerminal: number;
    extraOnTerminal: number;
    invalidEmployeeNo: number;
    missingList: { pnfl: string; name: string; type: string }[];
    extraList: { employeeNo: string; name: string | null }[];
    listLimit: number;
}

interface CompareStatus {
    state: CompareState | null;
    result: CompareResult | null;
}

function csvCell(value: string | null) {
    const text = value ?? '';
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Terminal bilan solishtirish: fonda ishlaydi, jarayon ko‘rsatiladi, oxirgi natija saqlanadi.
 * Oyna yopilsa ham jarayon to‘xtamaydi.
 */
export function TerminalCompare({ terminalId, disabled }: { terminalId: number; disabled?: boolean }) {
    const { t } = useTranslation();
    const status = useApiQuery<CompareStatus>(`/terminals/${terminalId}/person-sync/compare/status`);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState('');

    const state = status.data?.state ?? null;
    const result = status.data?.result ?? null;
    const running = state?.status === 'running' || starting;

    // Jarayon ketayotganda 1,5 soniyada bir yangilanadi.
    useInterval(status.retry, running ? 1500 : null);

    async function start() {
        if (running) return;
        setStarting(true);
        setStartError('');
        try {
            await authorizedPost(`/terminals/${terminalId}/person-sync/compare/start`, {});
            status.retry();
        } catch (error: unknown) {
            setStartError(error instanceof Error ? error.message : t('terminals.persons.compareFailed'));
        } finally {
            setStarting(false);
        }
    }

    function download() {
        if (!result) return;
        const lines = [
            ['section', 'pnfl_or_employeeNo', 'name', 'type'].join(','),
            ...result.missingList.map((row) => ['missing_on_terminal', row.pnfl, row.name, row.type].map(csvCell).join(',')),
            ...result.extraList.map((row) => ['extra_on_terminal', row.employeeNo, row.name, ''].map(csvCell).join(',')),
        ];
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `terminal-${terminalId}-solishtirish.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    const percent = state?.total ? Math.min(100, Math.round((100 * state.loaded) / state.total)) : 0;
    const truncated =
        result !== null &&
        (result.missingOnTerminal > result.missingList.length ||
            result.extraOnTerminal + result.invalidEmployeeNo > result.extraList.length);

    return (
        <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{t('terminals.persons.compareTitle')}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('terminals.persons.note')}</p>
                </div>
                <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={running || disabled} onClick={() => void start()}>
                    {running ? <Loader2 aria-hidden="true" className="animate-spin" /> : <GitCompareArrows aria-hidden="true" />}
                    {running ? t('terminals.compare.running') : result ? t('terminals.compare.rerun') : t('terminals.compare.start')}
                </Button>
            </div>

            {running && (
                <div className="space-y-2" role="status">
                    <Progress value={percent} aria-label={t('terminals.compare.running')} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {state?.total
                            ? t('terminals.compare.progress', { loaded: formatNumber(state.loaded), total: formatNumber(state.total) })
                            : t('terminals.compare.starting')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('terminals.compare.hint')}</p>
                </div>
            )}

            {startError && <p role="alert" className="text-sm text-destructive">{startError}</p>}
            {status.error && !status.data && <ErrorState message={status.error} onRetry={status.retry} />}
            {!running && state?.status === 'failed' && (
                <p role="alert" className="text-sm text-destructive">
                    {t('terminals.compare.failed', { error: state.error ?? '—' })}
                </p>
            )}

            {result && (
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {t('terminals.compare.checkedAt', { time: formatDateTime(result.comparedAt) })}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile label={t('terminals.persons.onTerminal')} value={result.terminalPersons} />
                        <StatTile label={t('terminals.persons.matched')} value={result.matched} tone="success" />
                        <StatTile label={t('terminals.persons.missing')} value={result.missingOnTerminal} tone={result.missingOnTerminal > 0 ? 'danger' : undefined} />
                        <StatTile
                            label={t('terminals.persons.extra')}
                            value={result.extraOnTerminal + result.invalidEmployeeNo}
                            tone={result.extraOnTerminal + result.invalidEmployeeNo > 0 ? 'warning' : undefined}
                        />
                    </div>
                    {result.invalidEmployeeNo > 0 && (
                        <p className="text-xs text-muted-foreground">{t('terminals.compare.invalid', { count: result.invalidEmployeeNo })}</p>
                    )}

                    {(result.missingList.length > 0 || result.extraList.length > 0) && (
                        <Tabs defaultValue={result.missingList.length > 0 ? 'missing' : 'extra'}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <TabsList>
                                    <TabsTrigger value="missing">{t('terminals.compare.missingTab', { count: result.missingOnTerminal })}</TabsTrigger>
                                    <TabsTrigger value="extra">
                                        {t('terminals.compare.extraTab', { count: result.extraOnTerminal + result.invalidEmployeeNo })}
                                    </TabsTrigger>
                                </TabsList>
                                <Button type="button" size="sm" variant="outline" onClick={download}>
                                    <Download aria-hidden="true" />
                                    {t('terminals.compare.csv')}
                                </Button>
                            </div>
                            <TabsContent value="missing" className="mt-3">
                                {result.missingList.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t('terminals.compare.missingEmpty')}</p>
                                ) : (
                                    <div className="max-h-72 overflow-auto rounded-lg border bg-card">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="pl-3">{t('terminals.compare.colName')}</TableHead>
                                                    <TableHead>{t('terminals.compare.colPnfl')}</TableHead>
                                                    <TableHead className="pr-3">{t('terminals.compare.colType')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.missingList.map((row) => (
                                                    <TableRow key={row.pnfl}>
                                                        <TableCell className="pl-3 whitespace-normal [overflow-wrap:anywhere]">{row.name || '—'}</TableCell>
                                                        <TableCell className="font-mono text-xs">{row.pnfl}</TableCell>
                                                        <TableCell className="pr-3">
                                                            <StatusBadge tone={row.type === 'TEACHER' ? 'primary' : 'info'} dot={false}>
                                                                {row.type === 'TEACHER' ? t('terminals.compare.teacher') : t('terminals.compare.student')}
                                                            </StatusBadge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="extra" className="mt-3">
                                {result.extraList.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t('terminals.compare.extraEmpty')}</p>
                                ) : (
                                    <div className="max-h-72 overflow-auto rounded-lg border bg-card">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="pl-3">{t('terminals.compare.colEmployeeNo')}</TableHead>
                                                    <TableHead className="pr-3">{t('terminals.compare.colTerminalName')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.extraList.map((row) => (
                                                    <TableRow key={row.employeeNo}>
                                                        <TableCell className="pl-3 font-mono text-xs">{row.employeeNo}</TableCell>
                                                        <TableCell className="pr-3 whitespace-normal [overflow-wrap:anywhere]">{row.name || '—'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                    {truncated && <p className="text-xs text-muted-foreground">{t('terminals.compare.limit', { count: result.listLimit })}</p>}
                </div>
            )}
        </section>
    );
}
