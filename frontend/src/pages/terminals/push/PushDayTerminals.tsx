import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { EmptyState } from '@/components/common/states';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate, formatNumber } from '@/lib/date';

import { humanLag, percent } from './push-shared';
import type { DayResponse } from './push-shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Sort = 'received' | 'noPicture' | 'lag' | 'name';

/** Tanlangan kun bo‘yicha har bir terminalning qabul qilingan ma’lumotlari. */
export function PushDayTerminals({ data, date }: { data: DayResponse | null; date: string }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<Sort>('received');

    const rows = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const list = (data?.terminals ?? []).filter(
            (row) =>
                !needle ||
                String(row.terminalId) === needle ||
                (row.terminalName ?? '').toLowerCase().includes(needle) ||
                (row.schoolName ?? '').toLowerCase().includes(needle),
        );
        const noPicture = (row: (typeof list)[number]) => {
            const total = row.push.withPicture + row.push.withoutPicture;
            return total > 0 ? row.push.withoutPicture / total : 0;
        };
        return [...list].sort((a, b) => {
            if (sort === 'name') return (a.terminalName ?? '').localeCompare(b.terminalName ?? '');
            if (sort === 'noPicture') return noPicture(b) - noPicture(a);
            if (sort === 'lag') return b.push.maxLagSeconds - a.push.maxLagSeconds;
            return b.push.received - a.push.received;
        });
    }, [data, search, sort]);

    return (
        <Card className="min-w-0 gap-0 py-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
                <div>
                    <h2 className="font-heading text-base font-bold">{t('syncHistory.push.byTerminal.title', { date: formatDate(date) })}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('syncHistory.push.byTerminal.hint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('syncHistory.push.byTerminal.search')}
                            aria-label={t('syncHistory.push.byTerminal.search')}
                            className="w-56 bg-background pl-9"
                        />
                    </div>
                    <div className="w-52">
                        <SelectField
                            value={sort}
                            onValueChange={(value) => setSort(value as Sort)}
                            aria-label={t('syncHistory.push.byTerminal.sort')}
                            options={(['received', 'noPicture', 'lag', 'name'] as Sort[]).map((value) => ({
                                value,
                                label: t(`syncHistory.push.byTerminal.sorts.${value}`),
                            }))}
                        />
                    </div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="p-4">
                    <EmptyState title={t('syncHistory.push.byTerminal.emptyTitle')} description={t('syncHistory.push.byTerminal.empty')} />
                </div>
            ) : (
                <div className="max-h-[34rem] overflow-auto">
                    <Table className="w-full min-w-[860px] text-sm">
                        <TableHeader className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                            <TableRow className="border-b">
                                <TableHead className="py-2.5 pr-3 pl-4 font-medium">{t('syncHistory.push.table.terminal')}</TableHead>
                                <TableHead className="py-2.5 pr-3 text-right font-medium">{t('syncHistory.push.day.received')}</TableHead>
                                <TableHead className="py-2.5 pr-3 text-right font-medium">{t('syncHistory.push.day.inserted')}</TableHead>
                                <TableHead className="py-2.5 pr-3 text-right font-medium">{t('syncHistory.push.day.duplicates')}</TableHead>
                                <TableHead className="py-2.5 pr-3 font-medium">{t('syncHistory.push.day.withPicture')}</TableHead>
                                <TableHead className="py-2.5 pr-3 text-right font-medium">{t('syncHistory.push.day.pull')}</TableHead>
                                <TableHead className="py-2.5 pr-4 font-medium">{t('syncHistory.push.byTerminal.lag')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="tabular-nums">
                            {rows.map((row) => {
                                const pictures = row.push.withPicture + row.push.withoutPicture;
                                const photoPercent = percent(row.push.withPicture, pictures);
                                return (
                                    <TableRow key={row.terminalId} className="border-b last:border-0 hover:bg-muted/30">
                                        <TableCell className="py-2.5 pr-3 pl-4">
                                            <span className="block font-medium">{row.terminalName ?? `#${row.terminalId}`}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                #{row.terminalId}
                                                {row.schoolName ? ` · ${row.schoolName}` : ''}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 pr-3 text-right">{formatNumber(row.push.received)}</TableCell>
                                        <TableCell className="py-2.5 pr-3 text-right font-semibold">{formatNumber(row.push.inserted)}</TableCell>
                                        <TableCell className="py-2.5 pr-3 text-right text-muted-foreground">{formatNumber(row.push.duplicates)}</TableCell>
                                        <TableCell className="py-2.5 pr-3">
                                            {photoPercent === null ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                                        <span className="block h-full rounded-full bg-success" style={{ width: `${photoPercent}%` }} />
                                                    </span>
                                                    <span className="w-9 text-right text-xs">{photoPercent}%</span>
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2.5 pr-3 text-right">{row.pull.inserted > 0 ? formatNumber(row.pull.inserted) : '—'}</TableCell>
                                        <TableCell className="py-2.5 pr-4 text-xs">{row.push.received > 0 ? humanLag(row.push.maxLagSeconds, t) : '—'}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Card>
    );
}
