import { useMemo, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { authorizedPut } from '@/lib/auth-session';
import { inUzbekistan, matchUnits, projectLatLng, useUzbekistanGeo } from '@/lib/geo';
import type { GeoShape } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { DashboardChild, DashboardOverview } from '@/types/dashboard';
import { ChartTooltip, TooltipRow } from './ChartTooltip';
import { RATE_BREAKS, binFill, formatCount, formatRate, rateBin } from './viz';

interface Props {
    overview: DashboardOverview;
    canMapGeo: boolean;
    onSelect: (child: DashboardChild) => void;
    onGeoChanged: () => void;
}

interface Hover {
    x: number;
    y: number;
    width: number;
    name: string;
    child: DashboardChild | null;
}

interface SchoolDot {
    child: DashboardChild;
    x: number;
    y: number;
}

function zoomBox(bbox: [number, number, number, number], aspect: number): string {
    const [minX, minY, maxX, maxY] = bbox;
    let width = maxX - minX;
    let height = maxY - minY;
    const pad = Math.max(width, height) * 0.08;
    width += pad * 2;
    height += pad * 2;
    // Konteyner nisbatini saqlaymiz — xarita cho‘zilmaydi.
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

/**
 * O‘zbekiston xaritasi: respublika darajasida viloyatlar, viloyat tanlanganda
 * uning tumanlari. Rang — o‘quvchilar davomati (5 bosqich). Bosilganda doira
 * shu hududga torayadi.
 */
export function UzbekistanMap({ overview, canMapGeo, onSelect, onGeoChanged }: Props) {
    const { t, i18n } = useTranslation();
    const { geo, error } = useUzbekistanGeo();
    const containerRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<Hover | null>(null);
    const language = (i18n.resolvedLanguage ?? 'uz') as 'uz' | 'uz-Cyrl' | 'ru' | 'en';

    const { level, region, district } = overview.scope;

    const view = useMemo(() => {
        if (!geo) return null;
        const aspect = geo.viewBox[2] / geo.viewBox[3];
        const countryBox = geo.viewBox.join(' ');

        if (level === 'COUNTRY') {
            const shapes = geo.regions.map((r) => ({ id: r.id, names: [r.name.uz, r.name.en, r.name.ru, r.name['uz-Cyrl']] }));
            const match = matchUnits(overview.children, shapes);
            return { viewBox: countryBox, active: geo.regions as GeoShape[], background: [] as GeoShape[], match, focus: null as string | null, dots: [] as SchoolDot[], zoomWidth: geo.viewBox[2] };
        }

        // Viloyat (yoki undan quyi) — tumanlar ko‘rinishi.
        const regionShapes = geo.regions.map((r) => ({ id: r.id, names: [r.name.uz, r.name.en, r.name.ru, r.name['uz-Cyrl']] }));
        const regionKey = region ? matchUnits([region], regionShapes).get(region.id) : undefined;
        const regionShape = geo.regions.find((r) => r.id === regionKey);
        if (!regionShape) return { viewBox: countryBox, active: [], background: geo.regions as GeoShape[], match: new Map<number, string>(), focus: null, missingRegion: true, dots: [] as SchoolDot[], zoomWidth: geo.viewBox[2] };

        const districtShapes = geo.districts.filter((d) => d.regionId === regionShape.id);
        const units = level === 'REGION' ? overview.children : district ? [{ id: district.id, name: district.name, geoKey: district.geoKey }] : [];
        const match = matchUnits(units, districtShapes.map((d) => ({ id: d.id, names: [d.name] })));
        const focus = level === 'REGION' ? null : district ? (match.get(district.id) ?? null) : null;

        // Tuman darajasida maktablar nuqta bo‘lib chiqadi (lokatsiyasi to‘g‘ri kiritilganlari).
        const dots: SchoolDot[] =
            level === 'DISTRICT'
                ? overview.children.flatMap((child) => {
                      if (child.latitude == null || child.longitude == null || !inUzbekistan(child.latitude, child.longitude)) return [];
                      const [x, y] = projectLatLng(child.latitude, child.longitude);
                      return [{ child, x, y }];
                  })
                : [];

        // Tuman tanlanganda xarita shu tumanga (va maktab nuqtalariga) yaqinlashadi.
        const focusShape = focus ? districtShapes.find((d) => d.id === focus) : undefined;
        // Maktab nuqtalari bo‘lsa — ularning o‘ziga (tuman konturi eski xaritada aniq bo‘lmasligi mumkin);
        // bitta nuqta haddan tashqari yaqinlashtirilmasligi uchun eng kichik kenglik beriladi.
        let box = regionShape.bbox;
        if (level === 'DISTRICT') {
            if (dots.length > 0) {
                const minSpan = 14;
                const [x0, y0, x1, y1] = [Math.min(...dots.map((d) => d.x)), Math.min(...dots.map((d) => d.y)), Math.max(...dots.map((d) => d.x)), Math.max(...dots.map((d) => d.y))];
                const cx = (x0 + x1) / 2;
                const cy = (y0 + y1) / 2;
                const half = Math.max((x1 - x0) / 2, (y1 - y0) / 2, minSpan / 2);
                box = [cx - half, cy - half, cx + half, cy + half];
            } else if (focusShape) {
                box = focusShape.bbox;
            }
        }
        const viewBox = zoomBox(box, aspect);

        return {
            viewBox,
            active: districtShapes as GeoShape[],
            background: geo.regions.filter((r) => r.id !== regionShape.id) as GeoShape[],
            match,
            focus,
            dots,
            zoomWidth: Number(viewBox.split(' ')[2]),
        };
    }, [geo, level, region, district, overview.children]);

    if (error) return <ErrorState message={t('dashboard.map.loadFailed')} />;
    if (!geo || !view) return <LoadingState rows={4} />;

    const childByShape = new Map<string, DashboardChild>();
    for (const child of overview.children) {
        const key = view.match.get(child.id);
        if (key) childByShape.set(key, child);
    }
    // Tuman/maktab darajasida tanlangan tuman umumiy foiz bilan bo‘yaladi.
    const focusRate = overview.students.rate;
    const schoolMode = level === 'DISTRICT';
    // Nuqta xarita masshtabiga moslanadi: kichik tumanda ham katta bo‘lib ketmaydi.
    const dotRadius = Math.min(6, Math.max(0.6, view.zoomWidth / 75));
    const dotted = new Set(view.dots.map((dot) => dot.child.id));
    const withoutLocation = schoolMode ? overview.children.filter((child) => !dotted.has(child.id)) : [];
    const unmatched = level === 'REGION' || level === 'COUNTRY' ? overview.children.filter((c) => !view.match.has(c.id)) : [];
    const freeShapes = view.active.filter((shape) => ![...view.match.values()].includes(shape.id));
    const shapeName = (shape: GeoShape) => {
        const regionShape = geo.regions.find((r) => r.id === shape.id);
        if (regionShape) return regionShape.shortName[language] ?? regionShape.shortName.uz;
        return geo.districts.find((d) => d.id === shape.id)?.name ?? shape.id;
    };

    function showTooltip(event: React.PointerEvent | React.FocusEvent, shape: GeoShape | null, child: DashboardChild | null) {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box) return;
        const target = (event.currentTarget as SVGElement).getBoundingClientRect();
        const x = 'clientX' in event ? event.clientX - box.left : target.left + target.width / 2 - box.left;
        const y = 'clientY' in event ? event.clientY - box.top : target.top - box.top;
        setHover({ x, y, width: box.width, name: child?.name ?? (shape ? shapeName(shape) : ''), child });
    }

    return (
        <div className="space-y-3">
            <div ref={containerRef} className="relative" onPointerLeave={() => setHover(null)}>
                <svg viewBox={view.viewBox} className="h-auto w-full" role="group" aria-label={t('dashboard.map.label')}>
                    <defs>
                        <pattern id="map-nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="6" height="6" fill="var(--viz-nodata)" />
                            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--viz-nodata-ink)" strokeWidth="1.5" />
                        </pattern>
                    </defs>
                    {view.background.map((shape) => (
                        <path key={shape.id} d={shape.d} fill="var(--viz-nodata)" opacity={0.45} stroke="var(--card)" strokeWidth={1} />
                    ))}
                    {view.active.map((shape) => {
                        const child = childByShape.get(shape.id) ?? null;
                        const isFocus = view.focus === shape.id;
                        // Maktab nuqtalari bor bo‘lsa, tuman o‘zi neytral (rangni nuqtalar beradi).
                        const rate = schoolMode ? null : child ? child.students.rate : isFocus ? focusRate : null;
                        const bin = rateBin(rate);
                        const dimmed = view.focus !== null && !isFocus;
                        const clickable = Boolean(child);
                        return (
                            <path
                                key={shape.id}
                                d={shape.d}
                                fill={bin === null ? (schoolMode ? (isFocus ? 'var(--viz-grid)' : 'var(--viz-nodata)') : child || isFocus ? 'url(#map-nodata)' : 'var(--viz-nodata)') : binFill(bin)}
                                opacity={dimmed ? 0.35 : 1}
                                stroke="var(--card)"
                                strokeWidth={isFocus ? 2.5 : 1.2}
                                className={cn('transition-[filter]', clickable && 'cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-110')}
                                tabIndex={clickable ? 0 : undefined}
                                role={clickable ? 'button' : undefined}
                                aria-label={
                                    child
                                        ? t('dashboard.map.unitLabel', { name: child.name, rate: formatRate(child.students.rate) })
                                        : undefined
                                }
                                onPointerMove={(event) => showTooltip(event, shape, child)}
                                onFocus={(event) => showTooltip(event, shape, child)}
                                onBlur={() => setHover(null)}
                                onClick={() => child && onSelect(child)}
                                onKeyDown={(event) => {
                                    if (child && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        onSelect(child);
                                    }
                                }}
                            />
                        );
                    })}
                    {/* Maktablar: davomat foiziga qarab bo‘yalgan nuqtalar */}
                    {view.dots.map(({ child, x, y }) => {
                        const bin = rateBin(child.students.rate);
                        return (
                            <circle
                                key={child.id}
                                cx={x}
                                cy={y}
                                r={dotRadius}
                                fill={bin === null ? 'var(--viz-nodata-ink)' : binFill(bin)}
                                stroke="var(--card)"
                                strokeWidth={dotRadius / 3}
                                className="cursor-pointer outline-none hover:brightness-110 focus-visible:stroke-[var(--foreground)]"
                                tabIndex={0}
                                role="button"
                                aria-label={t('dashboard.map.unitLabel', { name: child.name, rate: formatRate(child.students.rate) })}
                                onPointerMove={(event) => showTooltip(event, null, child)}
                                onFocus={(event) => showTooltip(event, null, child)}
                                onBlur={() => setHover(null)}
                                onClick={() => onSelect(child)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(child);
                                    }
                                }}
                            />
                        );
                    })}
                </svg>
                {hover && (
                    <ChartTooltip x={hover.x} y={hover.y} width={hover.width}>
                        <p className="mb-1 font-semibold">{hover.name}</p>
                        {hover.child ? (
                            <>
                                <TooltipRow label={t('dashboard.kpi.rate')} value={formatRate(hover.child.students.rate)} />
                                <TooltipRow
                                    label={t('dashboard.kpi.present')}
                                    value={`${formatCount(hover.child.students.present)} / ${formatCount(hover.child.students.expected)}`}
                                />
                                <TooltipRow label={t('dashboard.kpi.absent')} value={formatCount(hover.child.students.absent)} />
                                <TooltipRow label={t('dashboard.kpi.late')} value={formatCount(hover.child.students.late)} />
                            </>
                        ) : (
                            <p className="text-muted-foreground">{t('dashboard.map.noUnit')}</p>
                        )}
                    </ChartTooltip>
                )}
            </div>

            {/* Legenda: 5 bosqich + ma’lumot yo‘q */}
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={t('dashboard.map.legend')}>
                {[...RATE_BREAKS, null].map((limit, index) => (
                    <li key={index} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: binFill(index) }} />
                        {index === 0
                            ? `< ${RATE_BREAKS[0]}%`
                            : limit === null
                              ? `≥ ${RATE_BREAKS[RATE_BREAKS.length - 1]}%`
                              : `${RATE_BREAKS[index - 1]}–${limit}%`}
                    </li>
                ))}
                <li className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="size-3 rounded-sm">
                        <rect width="12" height="12" fill="url(#map-nodata)" />
                    </svg>
                    {t('dashboard.map.noData')}
                </li>
            </ul>

            {withoutLocation.length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    <MapPinOff aria-hidden="true" className="size-3.5" />
                    {t('dashboard.map.noLocation', { count: withoutLocation.length })}: {withoutLocation.map((child) => child.name).join(', ')}
                </p>
            )}

            {'missingRegion' in view && view.missingRegion && (
                <p className="text-xs text-muted-foreground">{t('dashboard.map.regionNotOnMap')}</p>
            )}

            {unmatched.length > 0 && (
                <UnmatchedUnits
                    units={unmatched}
                    level={level === 'COUNTRY' ? 'REGION' : 'DISTRICT'}
                    shapes={freeShapes.map((shape) => ({ id: shape.id, name: shapeName(shape) }))}
                    canEdit={canMapGeo}
                    onSaved={onGeoChanged}
                />
            )}
        </div>
    );
}

/** Xaritada topilmagan hududlar; super admin ularni qo‘lda bog‘laydi. */
function UnmatchedUnits({
    units,
    level,
    shapes,
    canEdit,
    onSaved,
}: {
    units: DashboardChild[];
    level: 'REGION' | 'DISTRICT';
    shapes: { id: string; name: string }[];
    canEdit: boolean;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function save(id: number, geoKey: string) {
        setBusy(true);
        setError('');
        try {
            await authorizedPut('/dashboard/geo-keys', { level, id, geoKey });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common.loadFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-xl border border-dashed p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPinOff aria-hidden="true" className="size-3.5" />
                    {t('dashboard.map.unmatched', { count: units.length })}: {units.map((u) => u.name).join(', ')}
                </p>
                {canEdit && shapes.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
                        {open ? t('common.close') : t('dashboard.map.assign')}
                    </Button>
                )}
            </div>
            {open && (
                <ul className="mt-2 space-y-1.5">
                    {units.map((unit) => (
                        <li key={unit.id} className="flex flex-wrap items-center gap-2">
                            <span className="min-w-40">{unit.name}</span>
                            <select
                                className="h-8 rounded-md border bg-background px-2"
                                defaultValue=""
                                disabled={busy}
                                aria-label={t('dashboard.map.assignFor', { name: unit.name })}
                                onChange={(event) => event.target.value && void save(unit.id, event.target.value)}
                            >
                                <option value="">{t('dashboard.map.chooseShape')}</option>
                                {shapes.map((shape) => (
                                    <option key={shape.id} value={shape.id}>
                                        {shape.name}
                                    </option>
                                ))}
                            </select>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p role="alert" className="mt-1 text-destructive">{error}</p>}
        </div>
    );
}
