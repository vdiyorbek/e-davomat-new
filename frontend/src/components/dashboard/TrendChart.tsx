import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useElementWidth } from '@/hooks/useElementWidth';
import { formatDate } from '@/lib/date';
import type { TrendPoint } from '@/types/dashboard';
import { ChartTooltip, TooltipRow } from './ChartTooltip';
import { formatRate } from './viz';

const HEIGHT = 220;
const PAD = { top: 12, right: 52, bottom: 28, left: 40 };
const SERIES = [
    { key: 'students', color: 'var(--viz-series-1)' },
    { key: 'teachers', color: 'var(--viz-series-2)' },
] as const;

/** Davomat foizi dinamikasi: o‘quvchilar va o‘qituvchilar (bitta o‘q, 0–100%). */
export function TrendChart({ points }: { points: TrendPoint[] }) {
    const { t } = useTranslation();
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    // Dam olish kunlari (kutilgan 0) chiziqda bo‘shliq emas — o‘tkazib yuboriladi.
    const days = points.filter((p) => p.students?.rate !== null && p.students?.rate !== undefined);
    const innerWidth = Math.max(0, width - PAD.left - PAD.right);
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (days.length <= 1 ? innerWidth / 2 : (i / (days.length - 1)) * innerWidth);
    const y = (rate: number) => PAD.top + innerHeight - (rate / 100) * innerHeight;

    const path = (key: 'students' | 'teachers') => {
        let d = '';
        let pen = false;
        days.forEach((day, i) => {
            const rate = day[key]?.rate;
            if (rate === null || rate === undefined) {
                pen = false;
                return;
            }
            d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(rate).toFixed(1)}`;
            pen = true;
        });
        return d;
    };

    const tickEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(innerWidth / 80))));
    const hover = hoverIndex !== null ? days[hoverIndex] : null;

    function onMove(event: React.PointerEvent<SVGRectElement>) {
        if (days.length === 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - box.left) / box.width;
        setHoverIndex(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
    }

    if (days.length === 0) {
        return <p className="py-10 text-center text-sm text-muted-foreground">{t('dashboard.trend.empty')}</p>;
    }

    return (
        <div className="space-y-3">
            <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label={t('dashboard.legend')}>
                {SERIES.map((series) => (
                    <li key={series.key} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: series.color }} />
                        {t(`dashboard.series.${series.key}`)}
                    </li>
                ))}
            </ul>
            <div ref={ref} className="relative" onPointerLeave={() => setHoverIndex(null)}>
                {width > 0 && (
                    <svg width={width} height={HEIGHT} role="img" aria-label={t('dashboard.trend.label')}>
                        {[0, 25, 50, 75, 100].map((tick) => (
                            <g key={tick}>
                                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
                                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                                    {tick}%
                                </text>
                            </g>
                        ))}
                        {days.map((day, i) =>
                            i % tickEvery === 0 || i === days.length - 1 ? (
                                <text key={day.date} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                                    {formatDate(day.date).slice(0, 5)}
                                </text>
                            ) : null,
                        )}
                        {hover && hoverIndex !== null && (
                            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + innerHeight} stroke="var(--viz-axis)" strokeWidth={1} />
                        )}
                        {SERIES.map((series) => (
                            <path key={series.key} d={path(series.key)} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                        ))}
                        {/* Oxirgi qiymat — chiziq uchida yorliq bilan */}
                        {SERIES.map((series) => {
                            const last = [...days].reverse().find((d) => d[series.key]?.rate != null);
                            if (!last) return null;
                            const i = days.indexOf(last);
                            const rate = last[series.key]!.rate!;
                            return (
                                <g key={series.key}>
                                    <circle cx={x(i)} cy={y(rate)} r={4} fill={series.color} stroke="var(--card)" strokeWidth={2} />
                                    <text x={x(i) + 8} y={y(rate)} dy="0.32em" className="fill-foreground text-[11px] font-semibold tabular-nums">
                                        {formatRate(rate)}
                                    </text>
                                </g>
                            );
                        })}
                        {hover &&
                            hoverIndex !== null &&
                            SERIES.map((series) =>
                                hover[series.key]?.rate != null ? (
                                    <circle key={series.key} cx={x(hoverIndex)} cy={y(hover[series.key]!.rate!)} r={4} fill={series.color} stroke="var(--card)" strokeWidth={2} />
                                ) : null,
                            )}
                        <rect
                            x={PAD.left}
                            y={PAD.top}
                            width={innerWidth}
                            height={innerHeight}
                            fill="transparent"
                            onPointerMove={onMove}
                            tabIndex={0}
                            aria-label={t('dashboard.trend.keyboard')}
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowRight') setHoverIndex((v) => Math.min(days.length - 1, (v ?? -1) + 1));
                                if (event.key === 'ArrowLeft') setHoverIndex((v) => Math.max(0, (v ?? days.length) - 1));
                            }}
                            onBlur={() => setHoverIndex(null)}
                            className="outline-none"
                        />
                    </svg>
                )}
                {hover && hoverIndex !== null && (
                    <ChartTooltip x={x(hoverIndex)} y={PAD.top} width={width}>
                        <p className="mb-1 font-semibold">{formatDate(hover.date)}</p>
                        {SERIES.map((series) => (
                            <TooltipRow key={series.key} color={series.color} label={t(`dashboard.series.${series.key}`)} value={formatRate(hover[series.key]?.rate)} />
                        ))}
                    </ChartTooltip>
                )}
            </div>
            <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">{t('dashboard.tableView')}</summary>
                <table className="mt-2 w-full tabular-nums">
                    <thead>
                        <tr className="text-left text-muted-foreground">
                            <th className="py-1 font-medium">{t('dashboard.date')}</th>
                            <th className="py-1 text-right font-medium">{t('dashboard.series.students')}</th>
                            <th className="py-1 text-right font-medium">{t('dashboard.series.teachers')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr key={day.date} className="border-t">
                                <td className="py-1">{formatDate(day.date)}</td>
                                <td className="py-1 text-right">{formatRate(day.students?.rate)}</td>
                                <td className="py-1 text-right">{formatRate(day.teachers?.rate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
