import { CircleAlert, CircleCheck, CircleHelp, CircleX, School, CalendarX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { DashboardOverview } from '@/types/dashboard';
import { formatCount } from './viz';

/** Raqamlarga qanchalik ishonish mumkin: terminallar va ma’lumot kelmagan maktablar. */
export function SystemHealth({ overview, canOpenTerminals }: { overview: DashboardOverview; canOpenTerminals: boolean }) {
    const { t } = useTranslation();
    const { terminals, schools } = overview;
    const rows = [
        { icon: CircleCheck, tone: 'text-success', label: t('dashboard.health.online'), value: terminals.online },
        { icon: CircleX, tone: 'text-destructive', label: t('dashboard.health.offline'), value: terminals.offline },
        { icon: CircleHelp, tone: 'text-muted-foreground', label: t('dashboard.health.unknown'), value: terminals.unknown },
    ];

    return (
        <div className="space-y-3 text-sm">
            <ul className="list-none space-y-1.5">
                {rows.map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                            <row.icon aria-hidden="true" className={`size-4 ${row.tone}`} />
                            {row.label}
                        </span>
                        <span className="font-semibold tabular-nums">{formatCount(row.value)}</span>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">
                {t('dashboard.health.terminalsTotal', { total: formatCount(terminals.total), push: formatCount(terminals.push), polling: formatCount(terminals.polling) })}
            </p>
            <div className="space-y-1.5 border-t pt-3">
                <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                        <School aria-hidden="true" className="size-4 text-muted-foreground" />
                        {t('dashboard.health.schools')}
                    </span>
                    <span className="font-semibold tabular-nums">{formatCount(schools.total)}</span>
                </p>
                {schools.withoutData > 0 && (
                    <p className="flex items-start gap-2">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                        <span>{t('dashboard.health.withoutData', { count: schools.withoutData })}</span>
                    </p>
                )}
                {schools.calendarAssumed > 0 && (
                    <p className="flex items-start gap-2">
                        <CalendarX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                        <span>{t('dashboard.health.calendarAssumed', { count: schools.calendarAssumed })}</span>
                    </p>
                )}
            </div>
            {canOpenTerminals && (
                <Link to="/terminals" className="block text-xs text-primary hover:underline">
                    {t('dashboard.health.openTerminals')}
                </Link>
            )}
        </div>
    );
}
