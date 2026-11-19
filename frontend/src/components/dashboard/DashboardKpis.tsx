import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { DashboardKpi } from '@/types/dashboard';
import { formatCount, formatRate } from './viz';

function Delta({ current, previous, upIsGood = true, points = true }: { current: number | null; previous: number | null | undefined; upIsGood?: boolean; points?: boolean }) {
    const { t } = useTranslation();
    if (current === null || previous === null || previous === undefined) return null;
    const diff = Math.round((current - previous) * 10) / 10;
    if (diff === 0) return <span className="text-xs text-muted-foreground">{t('dashboard.kpi.noChange')}</span>;
    const good = diff > 0 === upIsGood;
    const Icon = diff > 0 ? ArrowUp : ArrowDown;
    return (
        <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', good ? 'text-success' : 'text-destructive')}>
            <Icon aria-hidden="true" className="size-3" />
            {points ? `${Math.abs(diff).toLocaleString('uz-UZ')} ${t('dashboard.kpi.points')}` : formatCount(Math.abs(diff))}
            <span className="sr-only">{good ? t('dashboard.kpi.better') : t('dashboard.kpi.worse')}</span>
        </span>
    );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-xl border bg-card p-3">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-heading text-xl font-bold">{value}</p>
            {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}

/** Bitta guruh (o‘quvchilar yoki o‘qituvchilar) ko‘rsatkichlari: asosiy foiz + kartalar. */
export function KpiGroup({
    title,
    kpi,
    previous,
    previousLabel,
    isToday,
    hero,
}: {
    title: string;
    kpi: DashboardKpi;
    previous: DashboardKpi | null;
    previousLabel: string | null;
    isToday: boolean;
    hero?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <section aria-label={title} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
                    <p className={cn('font-heading font-bold', hero ? 'text-5xl' : 'text-3xl')}>{formatRate(kpi.rate)}</p>
                </div>
                <div className="text-right">
                    <Delta current={kpi.rate} previous={previous?.rate} />
                    {previousLabel && previous && <p className="text-xs text-muted-foreground">{t('dashboard.kpi.vs', { date: previousLabel })}</p>}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Tile label={t('dashboard.kpi.present')} value={`${formatCount(kpi.present)} / ${formatCount(kpi.expected)}`} />
                <Tile label={t('dashboard.kpi.absent')} value={formatCount(kpi.absent)} hint={<Delta current={kpi.absent} previous={previous?.absent} upIsGood={false} points={false} />} />
                <Tile label={t('dashboard.kpi.excused')} value={formatCount(kpi.excused)} />
                <Tile
                    label={t('dashboard.kpi.late')}
                    value={formatCount(kpi.late)}
                    hint={kpi.lateRate !== null ? t('dashboard.kpi.lateShare', { value: formatRate(kpi.lateRate) }) : undefined}
                />
            </div>
            {(isToday && kpi.inside > 0) || kpi.noData > 0 || kpi.unknown > 0 ? (
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {isToday && kpi.inside > 0 && <span>{t('dashboard.kpi.inside', { count: kpi.inside })}</span>}
                    {kpi.noData > 0 && <span>{t('dashboard.kpi.noData', { count: kpi.noData })}</span>}
                    {kpi.unknown - kpi.noData > 0 && <span>{t('dashboard.kpi.unknown', { count: kpi.unknown - kpi.noData })}</span>}
                </p>
            ) : null}
        </section>
    );
}
