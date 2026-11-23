import { CircleAlert, CircleCheck, CircleX, Cpu, Database, HardDrive, Image, Layers, Radio, RefreshCw, ScanFace, ChartNoAxesColumn } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { CheckKey, CheckStatus, HealthCheck, HealthSnapshot } from '@/types/system-health';

const ICONS: Record<CheckKey, LucideIcon> = {
    database: Database,
    redis: Layers,
    queues: Layers,
    disk: HardDrive,
    push: Radio,
    stats: ChartNoAxesColumn,
    photos: Image,
    terminals: ScanFace,
    process: Cpu,
};

const TONE: Record<CheckStatus, StatusTone> = { ok: 'success', warn: 'warning', crit: 'danger' };
const STATUS_ICON: Record<CheckStatus, LucideIcon> = { ok: CircleCheck, warn: CircleAlert, crit: CircleX };

/** Tarjima shabloniga beriladigan qiymatlar (raqamlar formatlanadi). */
function useValues(check: HealthCheck) {
    const { t } = useTranslation();
    const values: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(check.metrics)) {
        values[key] = typeof value === 'number' ? formatNumber(value) : (value ?? '—');
    }
    const uptime = check.metrics.uptimeMinutes;
    if (typeof uptime === 'number') {
        values.uptime = t('systemHealth.duration', { h: Math.floor(uptime / 60), m: uptime % 60 });
    }
    return values;
}

function CheckCard({ check }: { check: HealthCheck }) {
    const { t } = useTranslation();
    const values = useValues(check);
    const Icon = ICONS[check.key];
    const idle = (check.key === 'push' || check.key === 'stats') && check.metrics.working === 0;
    const error = typeof check.metrics.error === 'string' ? check.metrics.error : null;
    const noData = check.metrics.minutes === null && !idle && !error;

    return (
        <Card
            size="sm"
            className={cn(
                'gap-3 px-4',
                check.status === 'crit' && 'border-destructive/40',
                check.status === 'warn' && 'border-warning/50',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                        <Icon aria-hidden="true" className="size-4.5" />
                    </span>
                    <h3 className="font-heading text-sm font-bold [overflow-wrap:anywhere]">{t(`systemHealth.checks.${check.key}.name`)}</h3>
                </div>
                <StatusBadge tone={TONE[check.status]} className="shrink-0">
                    {t(`systemHealth.status.${check.status}`)}
                </StatusBadge>
            </div>
            <p className="text-sm [overflow-wrap:anywhere]">
                {error
                    ? t('systemHealth.error', { error })
                    : idle
                      ? t('systemHealth.idle')
                      : noData
                        ? t('systemHealth.noData')
                        : t(`systemHealth.checks.${check.key}.text`, values)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{t('systemHealth.since', { time: formatDateTime(check.since) })}</p>
        </Card>
    );
}

/** Bosh administrator uchun tizim holati: baza, Redis, navbatlar, disk va ma’lumot oqimi. */
export function SystemHealthPage() {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<HealthSnapshot>('/system/health');

    useInterval(retry, 30_000);

    const Overall = data ? STATUS_ICON[data.overall] : CircleCheck;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('systemHealth.title')}
                description={t('systemHealth.description')}
                actions={
                    <Button type="button" variant="outline" onClick={retry}>
                        <RefreshCw aria-hidden="true" />
                        {t('systemHealth.refresh')}
                    </Button>
                }
            />
            {loading && !data ? (
                <LoadingState rows={4} />
            ) : error && !data ? (
                <ErrorState message={error} onRetry={retry} />
            ) : data ? (
                <>
                    <div
                        role="status"
                        className={cn(
                            'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3',
                            data.overall === 'ok' && 'border-success/40 bg-success/8',
                            data.overall === 'warn' && 'border-warning/50 bg-warning/10',
                            data.overall === 'crit' && 'border-destructive/40 bg-destructive/8',
                        )}
                    >
                        <Overall
                            aria-hidden="true"
                            className={cn(
                                'size-6',
                                data.overall === 'ok' && 'text-success',
                                data.overall === 'warn' && 'text-warning',
                                data.overall === 'crit' && 'text-destructive',
                            )}
                        />
                        <p className="font-heading text-base font-bold">{t(`systemHealth.overall.${data.overall}`)}</p>
                        <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {t('systemHealth.updated', { time: formatDateTime(data.generatedAt) })}
                        </p>
                    </div>
                    <ul className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {data.checks.map((check) => (
                            <li key={check.key}>
                                <CheckCard check={check} />
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </div>
    );
}
