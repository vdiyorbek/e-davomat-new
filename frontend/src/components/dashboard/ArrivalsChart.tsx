import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useElementWidth } from '@/hooks/useElementWidth';
import { cn } from '@/lib/utils';
import type { DashboardArrivals } from '@/types/dashboard';
import { ChartTooltip, TooltipRow } from './ChartTooltip';
import { formatCount } from './viz';
import { Button } from '@/components/ui/button';

const HEIGHT = 200;
const PAD = { top: 22, right: 20, bottom: 28, left: 40 };

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** Kelish vaqti taqsimoti (10 daqiqa) va smena boshlanish chiziqlari. */
export function ArrivalsChart({ data }: { data: DashboardArrivals }) {
    const { t } = useTranslation();
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [type, setType] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
    const [hover, setHover] = useState<{ minute: number; count: number; x: number } | null>(null);

    const buckets = data.buckets.filter((b) => b.type === type);
    const step = data.bucketMinutes;
    const shiftMinutes = data.shifts.map((s) => {
        const [h, m] = s.startTime.split(':').map(Number);
        return h * 60 + m;
    });
    const firstData = buckets.length ? Math.min(...buckets.map((b) => b.minute)) : 7 * 60;
    const lastData = buckets.length ? Math.max(...buckets.map((b) => b.minute)) : 14 * 60;
    const from = Math.floor(Math.min(firstData, 7 * 60, ...shiftMinutes) / 60) * 60;
    const to = Math.ceil(Math.max(lastData + step, 9 * 60, ...shiftMinutes.map((m) => m + 30)) / 60) * 60;

    const slots = (to - from) / step;
    const innerWidth = Math.max(0, width - PAD.left - PAD.right);
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;
    const band = innerWidth / slots;
    const barWidth = Math.max(2, Math.min(24, band - 2));
    const max = Math.max(1, ...buckets.map((b) => b.count));
    const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
    const x = (minute: number) => PAD.left + ((minute - from) / step) * band;
    const y = (count: number) => PAD.top + innerHeight - (count / niceMax) * innerHeight;
    const total = buckets.reduce((sum, b) => sum + b.count, 0);

    return (
        <div className="space-y-3">
            <div role="radiogroup" aria-label={t('dashboard.arrivals.who')} className="inline-flex rounded-lg border p-0.5 text-xs">
                {(['STUDENT', 'TEACHER'] as const).map((value) => (
                    <Button variant="link" size="auto"
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={type === value}
                        onClick={() => setType(value)}
                        className={cn('rounded-md px-3 py-1', type === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                    >
                        {t(`dashboard.series.${value === 'STUDENT' ? 'students' : 'teachers'}`)}
                    </Button>
                ))}
            </div>
            <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
                {total === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">{t('dashboard.arrivals.empty')}</p>
                ) : (
                    width > 0 && (
                        <svg width={width} height={HEIGHT} role="img" aria-label={t('dashboard.arrivals.label')}>
                            {[0, niceMax / 2, niceMax].map((tick) => (
                                <g key={tick}>
                                    <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
                                    <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                                        {formatCount(tick)}
                                    </text>
                                </g>
                            ))}
                            {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60).map((minute) => (
                                <text key={minute} x={x(minute)} y={HEIGHT - 8} textAnchor={minute === to ? 'end' : 'middle'} className="fill-muted-foreground text-[11px] tabular-nums">
                                    {clock(minute)}
                                </text>
                            ))}
                            {buckets.map((bucket) => {
                                const left = x(bucket.minute) + (band - barWidth) / 2;
                                const top = y(bucket.count);
                                const h = PAD.top + innerHeight - top;
                                const r = Math.min(4, barWidth / 2, h);
                                return (
                                    <path
                                        key={bucket.minute}
                                        d={`M${left},${top + h}V${top + r}Q${left},${top} ${left + r},${top}H${left + barWidth - r}Q${left + barWidth},${top} ${left + barWidth},${top + r}V${top + h}Z`}
                                        fill="var(--viz-series-1)"
                                        opacity={hover && hover.minute !== bucket.minute ? 0.55 : 1}
                                    />
                                );
                            })}
                            {/* Smena boshlanishi — mos yozuv chiziqlari */}
                            {data.shifts.map((shift, i) => (
                                <g key={`${shift.code}-${shift.startTime}`}>
                                    <line x1={x(shiftMinutes[i])} x2={x(shiftMinutes[i])} y1={PAD.top - 4} y2={PAD.top + innerHeight} stroke="var(--foreground)" strokeOpacity={0.5} strokeWidth={1} />
                                    <text
                                        x={x(shiftMinutes[i]) + (x(shiftMinutes[i]) > width - 110 ? -4 : 4)}
                                        y={PAD.top - 8}
                                        textAnchor={x(shiftMinutes[i]) > width - 110 ? 'end' : 'start'}
                                        className="fill-muted-foreground text-[11px]"
                                    >
                                        {t('dashboard.arrivals.shiftStart', { code: shift.code, time: shift.startTime })}
                                    </text>
                                </g>
                            ))}
                            {/* Hover maydoni — ustundan kengroq */}
                            {Array.from({ length: slots }, (_, i) => from + i * step).map((minute) => {
                                const count = buckets.find((b) => b.minute === minute)?.count ?? 0;
                                return (
                                    <rect
                                        key={minute}
                                        x={x(minute)}
                                        y={PAD.top}
                                        width={band}
                                        height={innerHeight}
                                        fill="transparent"
                                        onPointerMove={() => setHover({ minute, count, x: x(minute) + band / 2 })}
                                    />
                                );
                            })}
                        </svg>
                    )
                )}
                {hover && (
                    <ChartTooltip x={hover.x} y={PAD.top} width={width}>
                        <p className="mb-1 font-semibold tabular-nums">
                            {clock(hover.minute)}–{clock(hover.minute + step)}
                        </p>
                        <TooltipRow label={t('dashboard.arrivals.people')} value={formatCount(hover.count)} />
                    </ChartTooltip>
                )}
            </div>
            <Collapsible className="text-xs">
                <CollapsibleTrigger className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {t('dashboard.tableView')}
                </CollapsibleTrigger>
                <CollapsibleContent>
                <Table className="mt-2 w-full tabular-nums">
                    <TableBody>
                        {buckets
                            .slice()
                            .sort((a, b) => a.minute - b.minute)
                            .map((bucket) => (
                                <TableRow key={bucket.minute} className="border-t">
                                    <TableCell className="py-1">
                                        {clock(bucket.minute)}–{clock(bucket.minute + step)}
                                    </TableCell>
                                    <TableCell className="py-1 text-right">{formatCount(bucket.count)}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
