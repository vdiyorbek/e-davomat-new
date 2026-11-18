import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { bandBarClass, bandTone } from '@/lib/attendance-summary';
import { formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { SummaryItem, SummaryMembershipType } from '@/types/attendance-summary';

interface Props {
    item: SummaryItem;
    title: string;
    subtitle: string | null;
    membershipType: SummaryMembershipType;
    /** Tugma matni: «Ichkariga kirish» yoki «Ro‘yxatni ochish». */
    actionLabel: string;
    onOpen: () => void;
}

const STATS = [
    { key: 'present', className: 'text-success' },
    { key: 'absent', className: 'text-destructive' },
    { key: 'excused', className: 'text-info' },
    { key: 'dayOff', className: 'text-muted-foreground' },
] as const;

/** Bitta hudud / maktab / sinf kartasi. Butun karta bosiladi. */
export function SummaryCard({ item, title, subtitle, membershipType, actionLabel, onOpen }: Props) {
    const { t } = useTranslation();
    const rateText = item.rate === null ? '—' : `${formatNumber(item.rate)}%`;

    return (
        <article className="group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-within:border-primary/50">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate font-heading text-base font-bold" title={title}>
                        {title}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                        {subtitle ? `${subtitle} · ` : ''}
                        {t(`attendanceSummary.personsCount.${membershipType}`, {
                            count: item.persons,
                            formatted: formatNumber(item.persons),
                        })}
                    </p>
                </div>
                <StatusBadge tone={bandTone(item.band)} className="shrink-0">
                    {t(`attendanceSummary.bands.${item.band ?? 'NONE'}`)}
                </StatusBadge>
            </div>

            <div className="space-y-2">
                <p className="font-heading text-3xl leading-none font-bold tabular-nums">{rateText}</p>
                <div
                    role="progressbar"
                    aria-label={t('attendanceSummary.kpi.rate')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.rate ?? undefined}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                >
                    <div
                        className={cn('h-full rounded-full transition-[width] duration-500', bandBarClass(item.band))}
                        style={{ width: `${Math.min(100, Math.max(0, item.rate ?? 0))}%` }}
                    />
                </div>
            </div>

            <dl className="grid grid-cols-4 gap-1.5 text-center">
                {STATS.map((stat) => (
                    <div key={stat.key} className="min-w-0 rounded-lg bg-muted/50 px-1 py-1.5">
                        <dt className="truncate text-[11px] text-muted-foreground">
                            {t(`attendanceSummary.stats.${stat.key}`)}
                        </dt>
                        <dd className={cn('truncate text-sm font-semibold tabular-nums', stat.className)}>
                            {formatNumber(item[stat.key])}
                        </dd>
                    </div>
                ))}
            </dl>

            {/* Butun karta bosiladigan bo‘lishi uchun tugma kartani to‘liq qoplaydi. */}
            <button
                type="button"
                onClick={onOpen}
                className="mt-auto inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                aria-label={`${title} — ${actionLabel}`}
            >
                {actionLabel}
                <ChevronRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
        </article>
    );
}
