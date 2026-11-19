import { useTranslation } from 'react-i18next';

import type { DashboardOverview } from '@/types/dashboard';
import { formatCount, formatRate } from './viz';

/** 1- va 2-smena davomati (o‘lchagich). */
export function ShiftSplit({ shifts }: { shifts: DashboardOverview['shifts'] }) {
    const { t } = useTranslation();
    const used = shifts.filter((shift) => shift.expected > 0);
    if (used.length === 0) return <p className="text-sm text-muted-foreground">{t('dashboard.shifts.empty')}</p>;

    return (
        <ul className="list-none space-y-4">
            {used.map((shift) => (
                <li key={shift.code} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{t('classes.shift.nameN', { code: shift.code })}</span>
                        <span className="font-heading text-lg font-bold tabular-nums">{formatRate(shift.rate)}</span>
                    </div>
                    <div
                        className="h-2 rounded-full"
                        style={{ background: 'color-mix(in oklab, var(--viz-series-1) 18%, transparent)' }}
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={shift.rate ?? 0}
                        aria-label={t('classes.shift.nameN', { code: shift.code })}
                    >
                        <div className="h-full rounded-full" style={{ width: `${shift.rate ?? 0}%`, background: 'var(--viz-series-1)' }} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {t('dashboard.shifts.detail', {
                            present: formatCount(shift.present),
                            expected: formatCount(shift.expected),
                            late: formatCount(shift.late),
                        })}
                    </p>
                </li>
            ))}
        </ul>
    );
}
