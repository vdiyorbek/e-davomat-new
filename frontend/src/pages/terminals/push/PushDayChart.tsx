import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { addDays, formatDate, formatNumber, todayInTashkent } from '@/lib/date';

import { percent } from './push-shared';
import type { DayResponse } from './push-shared';

interface Props {
    date: string;
    onDateChange: (date: string) => void;
    data: DayResponse | null;
    loading: boolean;
    error: string;
    onRetry: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="min-w-0 rounded-xl border bg-muted/30 px-3 py-2.5">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate font-heading text-xl font-bold tabular-nums">{value}</p>
            {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

/** Tanlangan kun: soatlar bo‘yicha yangi saqlangan eventlar (push va olish alohida) va kun jami. */
export function PushDayChart({ date, onDateChange, data, loading, error, onRetry }: Props) {
    const { t } = useTranslation();
    const today = todayInTashkent();

    const max = Math.max(1, ...(data?.hours ?? []).map((h) => h.push.inserted + h.pull.inserted));
    const peak = (data?.hours ?? []).reduce(
        (best, h) => (h.push.inserted + h.pull.inserted > best.value ? { hour: h.hour, value: h.push.inserted + h.pull.inserted } : best),
        { hour: -1, value: 0 },
    );
    const totals = data?.totals;
    const photoPercent = totals ? percent(totals.pushWithPicture, totals.pushWithPicture + totals.pushWithoutPicture) : null;

    return (
        <Card className="min-w-0 gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                    <h2 className="font-heading text-base font-bold">{t('syncHistory.push.day.title')}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('syncHistory.push.day.hint')}</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button type="button" variant="outline" size="icon" aria-label={t('syncHistory.push.day.prev')} onClick={() => onDateChange(addDays(date, -1))}>
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Input
                        type="date"
                        value={date}
                        max={today}
                        aria-label={t('syncHistory.push.day.date')}
                        className="w-40 bg-background"
                        onChange={(event) => event.target.value && onDateChange(event.target.value)}
                    />
                    <Button type="button" variant="outline" size="icon" aria-label={t('syncHistory.push.day.next')} disabled={date >= today} onClick={() => onDateChange(addDays(date, 1))}>
                        <ChevronRight aria-hidden="true" />
                    </Button>
                    {date !== today && (
                        <Button type="button" variant="ghost" onClick={() => onDateChange(today)}>
                            {t('syncHistory.push.day.today')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4 p-4">
                {loading && !data ? (
                    <LoadingState rows={4} className="border-0 p-0 sm:p-0" />
                ) : error || !data ? (
                    <ErrorState message={error || t('syncHistory.common.loadFailed')} onRetry={onRetry} />
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                            <Stat label={t('syncHistory.push.day.received')} value={formatNumber(totals?.pushReceived ?? 0)} />
                            <Stat label={t('syncHistory.push.day.inserted')} value={formatNumber(totals?.pushInserted ?? 0)} hint={t('syncHistory.push.day.insertedHint')} />
                            <Stat label={t('syncHistory.push.day.duplicates')} value={formatNumber(totals?.pushDuplicates ?? 0)} hint={t('syncHistory.push.day.duplicatesHint')} />
                            <Stat label={t('syncHistory.push.day.withPicture')} value={photoPercent === null ? '—' : `${photoPercent}%`} hint={t('syncHistory.push.day.withPictureHint')} />
                            <Stat label={t('syncHistory.push.day.pull')} value={formatNumber(totals?.pullInserted ?? 0)} hint={t('syncHistory.push.day.pullHint')} />
                        </div>

                        <div>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-3">
                                    <span className="flex items-center gap-1.5">
                                        <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1" />
                                        {t('syncHistory.push.day.legendPush')}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-3" />
                                        {t('syncHistory.push.day.legendPull')}
                                    </span>
                                </span>
                                {peak.hour >= 0 && (
                                    <span>
                                        {t('syncHistory.push.day.peak', {
                                            hour: `${String(peak.hour).padStart(2, '0')}:00`,
                                            count: formatNumber(peak.value),
                                        })}
                                    </span>
                                )}
                            </div>
                            <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={t('syncHistory.push.day.chartLabel', { date: formatDate(date) })}>
                                {data.hours.map((h) => {
                                    const pushPart = (h.push.inserted / max) * 100;
                                    const pullPart = (h.pull.inserted / max) * 100;
                                    return (
                                        <div key={h.hour} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none">
                                            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus:block">
                                                <p className="font-semibold">{`${String(h.hour).padStart(2, '0')}:00–${String((h.hour + 1) % 24).padStart(2, '0')}:00`}</p>
                                                <p>{t('syncHistory.push.day.tipPush', { new: formatNumber(h.push.inserted), received: formatNumber(h.push.received) })}</p>
                                                {h.pull.inserted > 0 && <p>{t('syncHistory.push.day.tipPull', { count: formatNumber(h.pull.inserted) })}</p>}
                                                <p className="text-muted-foreground">{t('syncHistory.push.day.tipTerminals', { count: h.push.terminals })}</p>
                                            </div>
                                            {pullPart > 0 && <div className="rounded-t-sm bg-chart-3" style={{ height: `${Math.max(pullPart, 1.5)}%` }} />}
                                            {pushPart > 0 && (
                                                <div
                                                    className={pullPart > 0 ? 'mt-[2px] bg-chart-1' : 'rounded-t-sm bg-chart-1'}
                                                    style={{ height: `${Math.max(pushPart, 1.5)}%` }}
                                                />
                                            )}
                                            {pushPart === 0 && pullPart === 0 && <div className="h-px bg-border" />}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground tabular-nums" aria-hidden="true">
                                {data.hours.map((h) => (
                                    <span key={h.hour} className="min-w-0 flex-1 text-center">
                                        {h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}
