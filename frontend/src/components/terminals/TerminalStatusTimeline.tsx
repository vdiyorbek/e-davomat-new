import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatDateTime, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';

import { StatTile } from './StatTile';

type TimelineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

interface StatusHistoryResponse {
    date: string;
    from: string;
    to: string;
    segments: Array<{ status: TimelineStatus; from: string; to: string }>;
    onlineMs: number;
    offlineMs: number;
    unknownMs: number;
    uptimePercent: number | null;
    isToday: boolean;
    generatedAt: string;
    outages: Array<{
        startedAt: string;
        endedAt: string | null;
        durationMs: number;
        lastError: string | null;
    }>;
    current: { status: TimelineStatus; since: string | null } | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const SEGMENT_COLORS: Record<TimelineStatus, string> = {
    ONLINE: 'bg-success',
    OFFLINE: 'bg-destructive',
    UNKNOWN: 'bg-muted-foreground/25',
};

const BADGE_TONES = { ONLINE: 'success', OFFLINE: 'danger', UNKNOWN: 'neutral' } as const;

/** Toshkent vaqti bo‘yicha «14:05». */
const clock = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
});

/** Tanlangan kun ichida — faqat soat; boshqa kunda — to‘liq sana va soat. */
function formatMoment(iso: string, dayFrom: string): string {
    const time = new Date(iso).getTime();
    const start = new Date(dayFrom).getTime();
    return time >= start && time < start + DAY_MS ? clock.format(new Date(iso)) : formatDateTime(iso);
}

function formatDuration(ms: number, t: TFunction): string {
    const minutes = Math.floor(Math.max(0, ms) / 60_000);
    if (minutes < 1) return t('terminals.uptime.lessThanMinute');
    const hours = Math.floor(minutes / 60);
    return hours > 0
        ? t('terminals.uptime.hoursMinutes', { h: hours, m: minutes % 60 })
        : t('terminals.uptime.minutes', { m: minutes });
}

/**
 * Terminalning bir kunlik ish holati: 24 soatlik chiziq, uptime va uzilishlar.
 * Sana tanlanmasa — bugun (har daqiqada yangilanadi).
 */
export function TerminalStatusTimeline({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const today = todayInTashkent();

    // Bo‘sh qator — «bugun»: so‘rovga sana qo‘shilmaydi.
    const [date, setDate] = useState('');

    const query = useApiQuery<StatusHistoryResponse>(
        `/terminals/${terminalId}/status-history${date ? `?date=${date}` : ''}`,
    );

    // O‘tgan kun o‘zgarmaydi — faqat bugunni yangilaymiz.
    useInterval(query.retry, date ? null : 60_000);

    const data = query.data;

    return (
        <section className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t('terminals.uptime.title')}</h3>
                <div className="flex items-center gap-2">
                    {date && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDate('')}>
                            {t('terminals.uptime.today')}
                        </Button>
                    )}
                    <Input
                        type="date"
                        aria-label={t('terminals.uptime.date')}
                        value={date || today}
                        max={today}
                        onChange={(event) => {
                            const value = event.target.value;
                            // Bo‘sh, bugungi yoki kelajakdagi sana — bugun.
                            setDate(!value || value >= today ? '' : value);
                        }}
                        className="h-9 w-auto"
                    />
                </div>
            </div>

            {query.loading && (
                <div className="space-y-3" aria-busy="true">
                    <Skeleton className="h-8 rounded-md" />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-[72px] rounded-xl" />
                        ))}
                    </div>
                </div>
            )}

            {query.error && (
                <p role="alert" className="text-sm text-destructive">
                    {query.error || t('terminals.uptime.loadFailed')}
                </p>
            )}

            {data && (
                <>
                    {data.isToday && data.current && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t('terminals.uptime.now')}:</span>
                            <StatusBadge tone={BADGE_TONES[data.current.status]}>
                                {t(`terminals.uptime.legend.${data.current.status}`)}
                            </StatusBadge>
                            {data.current.since && (
                                <span className="text-muted-foreground">
                                    {t('terminals.uptime.since', {
                                        time: formatMoment(data.current.since, data.from),
                                        duration: formatDuration(
                                            new Date(data.generatedAt).getTime() -
                                            new Date(data.current.since).getTime(),
                                            t,
                                        ),
                                    })}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 24 soatlik chiziq: kelajak qismi bo‘sh qoladi */}
                    <div>
                        <div
                            className="relative h-8 overflow-hidden rounded-md bg-muted/40"
                            role="img"
                            aria-label={t('terminals.uptime.title')}
                        >
                            {data.segments.map((segment) => {
                                const start = new Date(data.from).getTime();
                                const from = new Date(segment.from).getTime();
                                const to = new Date(segment.to).getTime();
                                return (
                                    <div
                                        key={`${segment.status}-${segment.from}`}
                                        className={cn('absolute inset-y-0', SEGMENT_COLORS[segment.status])}
                                        style={{
                                            left: `${((from - start) / DAY_MS) * 100}%`,
                                            width: `${Math.max(((to - from) / DAY_MS) * 100, 0.15)}%`,
                                        }}
                                        title={`${clock.format(new Date(segment.from))}–${clock.format(new Date(segment.to))} · ${t(`terminals.uptime.legend.${segment.status}`)}`}
                                    />
                                );
                            })}
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                            {['00:00', '06:00', '12:00', '18:00', '24:00'].map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {(['ONLINE', 'OFFLINE', 'UNKNOWN'] as const).map((status) => (
                                <span key={status} className="flex items-center gap-1.5">
                                    <span className={cn('size-2.5 rounded-sm', SEGMENT_COLORS[status])} />
                                    {t(`terminals.uptime.legend.${status}`)}
                                </span>
                            ))}
                        </div>
                    </div>

                    {data.uptimePercent === null ? (
                        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                            {t('terminals.uptime.noData')}
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <StatTile
                                    label={t('terminals.uptime.uptime')}
                                    value={`${data.uptimePercent}%`}
                                    tone={
                                        data.uptimePercent >= 99
                                            ? 'success'
                                            : data.uptimePercent >= 90
                                                ? 'warning'
                                                : 'danger'
                                    }
                                />
                                <StatTile label={t('terminals.uptime.onlineTime')} value={formatDuration(data.onlineMs, t)} />
                                <StatTile
                                    label={t('terminals.uptime.offlineTime')}
                                    value={formatDuration(data.offlineMs, t)}
                                    tone={data.offlineMs > 0 ? 'danger' : undefined}
                                />
                                <StatTile
                                    label={t('terminals.uptime.outages')}
                                    value={data.outages.length}
                                    tone={data.outages.length > 0 ? 'warning' : undefined}
                                />
                            </div>

                            {data.outages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('terminals.uptime.noOutages')}</p>
                            ) : (
                                <ol className="divide-y rounded-lg border">
                                    {data.outages.map((outage) => (
                                        <li
                                            key={outage.startedAt}
                                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
                                        >
                                            <span className="font-medium tabular-nums">
                                                {formatMoment(outage.startedAt, data.from)} –{' '}
                                                {outage.endedAt
                                                    ? formatMoment(outage.endedAt, data.from)
                                                    : t('terminals.uptime.ongoing')}
                                            </span>
                                            <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="tabular-nums">{formatDuration(outage.durationMs, t)}</span>
                                                {outage.lastError && (
                                                    <span className="max-w-60 truncate text-destructive" title={outage.lastError}>
                                                        {outage.lastError}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    );
}