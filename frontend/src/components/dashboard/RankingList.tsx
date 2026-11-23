import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { DashboardChild } from '@/types/dashboard';
import { binFill, formatCount, formatRate, rateBin } from './viz';
import { Button } from '@/components/ui/button';

/** Eng past / eng yuqori davomatli hududlar (yoki sinflar); bosilsa — ichiga kiradi. */
export function RankingList({
    items,
    onSelect,
    unitLabel,
}: {
    items: DashboardChild[];
    onSelect?: (child: DashboardChild) => void;
    unitLabel: string;
}) {
    const { t } = useTranslation();
    const [order, setOrder] = useState<'worst' | 'best'>('worst');
    const rated = items.filter((item) => item.students.rate !== null);
    const sorted = [...rated].sort((a, b) =>
        order === 'worst' ? a.students.rate! - b.students.rate! : b.students.rate! - a.students.rate!,
    );
    const shown = sorted.slice(0, 10);
    const missing = items.length - rated.length;

    return (
        <div className="space-y-3">
            <div role="radiogroup" aria-label={t('dashboard.ranking.order')} className="inline-flex rounded-lg border p-0.5 text-xs">
                {(['worst', 'best'] as const).map((value) => (
                    <Button variant="link" size="auto"
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={order === value}
                        onClick={() => setOrder(value)}
                        className={cn('rounded-md px-3 py-1', order === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                    >
                        {t(`dashboard.ranking.${value}`)}
                    </Button>
                ))}
            </div>
            {shown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('dashboard.ranking.empty')}</p>
            ) : (
                <ol className="list-none space-y-1">
                    {shown.map((item, index) => {
                        const rate = item.students.rate ?? 0;
                        const content = (
                            <>
                                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{item.name}</span>
                                    <span className="relative mt-1 block h-2 rounded-full bg-muted">
                                        <span
                                            className="absolute inset-y-0 left-0 rounded-full"
                                            style={{ width: `${Math.max(2, rate)}%`, background: binFill(rateBin(rate)) }}
                                        />
                                    </span>
                                </span>
                                <span className="w-24 shrink-0 text-right">
                                    <span className="block text-sm font-semibold tabular-nums">{formatRate(item.students.rate)}</span>
                                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                                        {t('dashboard.ranking.absentN', { count: formatCount(item.students.absent) })}
                                    </span>
                                </span>
                                {onSelect && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                            </>
                        );
                        return (
                            <li key={item.id}>
                                {onSelect ? (
                                    <Button variant="ghost" size="auto"
                                        type="button"
                                        onClick={() => onSelect(item)}
                                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        {content}
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-3 px-2 py-1.5">{content}</div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
            {missing > 0 && <p className="text-xs text-muted-foreground">{t('dashboard.ranking.missing', { count: missing, unit: unitLabel })}</p>}
        </div>
    );
}
