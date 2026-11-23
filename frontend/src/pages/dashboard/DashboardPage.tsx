import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AbsenceStreaks } from '@/components/dashboard/AbsenceStreaks';
import { ArrivalsChart } from '@/components/dashboard/ArrivalsChart';
import { KpiGroup } from '@/components/dashboard/DashboardKpis';
import { RankingList } from '@/components/dashboard/RankingList';
import { ShiftSplit } from '@/components/dashboard/ShiftSplit';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { UzbekistanMap } from '@/components/dashboard/UzbekistanMap';
import { binFill, binInk, formatCount, formatRate, rateBin } from '@/components/dashboard/viz';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { useTheme } from '@/hooks/useTheme';
import { addDays, formatDate, formatDateLong, formatTime, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { DashboardArrivals, DashboardChild, DashboardOverview, DashboardTrend } from '@/types/dashboard';
import { DatePicker } from '@/components/common/DatePicker';

const ID = /^[1-9]\d*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function Panel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
    return (
        <section className={cn('min-w-0 space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5', className)}>
            <div>
                <h2 className="font-heading text-base font-bold">{title}</h2>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            {children}
        </section>
    );
}

/** Maktab darajasi: sinflar kesimidagi «issiqlik» jadvali. */
function ClassGrid({ items }: { items: DashboardChild[] }) {
    const { t } = useTranslation();
    const { resolved } = useTheme();
    if (items.length === 0) return <p className="text-sm text-muted-foreground">{t('dashboard.classes.empty')}</p>;
    return (
        <ul className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {items.map((item) => {
                const off = item.dayState === 'DAY_OFF';
                const bin = off ? null : rateBin(item.students.rate);
                return (
                    <li
                        key={item.id}
                        className="rounded-xl border p-3"
                        style={bin === null ? undefined : { background: binFill(bin), color: binInk(bin, resolved === 'dark'), borderColor: 'transparent' }}
                        title={`${item.name}: ${formatRate(item.students.rate)}`}
                    >
                        <p className="flex items-center justify-between gap-1">
                            <span className="font-heading text-lg font-bold">{item.name}</span>
                            {item.shiftCode && <span className="text-[11px] opacity-80">{t('classes.shift.nameN', { code: item.shiftCode })}</span>}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">{off ? t('dashboard.classes.dayOff') : formatRate(item.students.rate)}</p>
                        {!off && (
                            <p className="text-[11px] tabular-nums opacity-80">
                                {t('dashboard.classes.detail', { absent: formatCount(item.students.absent), late: formatCount(item.students.late) })}
                            </p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

export function DashboardPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const role = session?.profile.role;
    const [params, setParams] = useSearchParams();
    const today = todayInTashkent();

    const rawDate = params.get('date');
    const date = rawDate && DATE.test(rawDate) && rawDate <= today ? rawDate : today;
    const scope = new URLSearchParams();
    for (const key of ['regionId', 'districtId', 'schoolId']) {
        const value = params.get(key);
        if (value && ID.test(value)) scope.set(key, value);
    }
    const scopeQuery = `${scope.toString()}${scope.size ? '&' : ''}date=${date}`;

    const overview = useApiQuery<DashboardOverview>(`/dashboard/overview?${scopeQuery}`);
    const trend = useApiQuery<DashboardTrend>(`/dashboard/trend?${scope.toString()}${scope.size ? '&' : ''}from=${addDays(date, -29)}&to=${date}`);
    const arrivals = useApiQuery<DashboardArrivals>(`/dashboard/arrivals?${scopeQuery}`);
    const isToday = date === today;

    // Bugungi kun — har daqiqada yangilanadi (eski ko‘rinish saqlangan holda).
    useInterval(() => {
        overview.retry();
        arrivals.retry();
    }, isToday ? 60_000 : null);

    function navigate(next: Record<string, string | null>) {
        const result = new URLSearchParams(params);
        for (const [key, value] of Object.entries(next)) {
            if (value === null) result.delete(key);
            else result.set(key, value);
        }
        setParams(result);
    }

    function selectChild(child: DashboardChild) {
        const level = overview.data?.scope.level;
        if (level === 'COUNTRY') navigate({ regionId: String(child.id), districtId: null, schoolId: null });
        if (level === 'REGION') navigate({ districtId: String(child.id), schoolId: null });
        if (level === 'DISTRICT') navigate({ schoolId: String(child.id) });
    }

    const data = overview.data;
    const level = data?.scope.level;
    // Rol doirasidan yuqoriga chiqib bo‘lmaydi.
    const topLevel = role === 'SUPER_ADMIN' ? 0 : role === 'REGION_ADMIN' ? 1 : role === 'DISTRICT_ADMIN' ? 2 : 3;
    type Crumb = { label: string; params: Record<string, string | null> };
    const crumbs: Crumb[] = data
        ? ([
              { label: t('dashboard.scope.country'), params: { regionId: null, districtId: null, schoolId: null } },
              data.scope.region && { label: data.scope.region.name, params: { regionId: String(data.scope.region.id), districtId: null, schoolId: null } },
              data.scope.district && { label: data.scope.district.name, params: { districtId: String(data.scope.district.id), schoolId: null } },
              data.scope.school && { label: data.scope.school.name, params: { schoolId: String(data.scope.school.id) } },
          ] as (Crumb | null)[]).filter((item): item is Crumb => item !== null)
        : [];
    const visibleCrumbs = crumbs.slice(Math.min(topLevel, Math.max(0, crumbs.length - 1)));
    const unitLabel =
        level === 'COUNTRY' ? t('dashboard.units.regions') : level === 'REGION' ? t('dashboard.units.districts') : level === 'DISTRICT' ? t('dashboard.units.schools') : t('dashboard.units.classes');

    return (
        <div className="w-full min-w-0 space-y-5 sm:space-y-6">
            <PageHeader
                eyebrow={t('dashboard.eyebrow')}
                title={data ? (data.scope.school?.name ?? data.scope.district?.name ?? data.scope.region?.name ?? t('dashboard.scope.country')) : t('dashboard.title')}
                description={`${formatDateLong(date)}${data?.computedAt ? ` · ${t('dashboard.updatedAt', { time: formatTime(data.computedAt) })}` : ''}`}
            />

            {/* Filtrlar — bitta qator, hamma bloklarga ta’sir qiladi */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
                <div role="radiogroup" aria-label={t('dashboard.date')} className="inline-flex rounded-lg border p-0.5 text-sm">
                    {[
                        { label: t('dashboard.dates.today'), value: today },
                        { label: t('dashboard.dates.yesterday'), value: addDays(today, -1) },
                    ].map((preset) => (
                        <Button variant="link" size="auto"
                            key={preset.value}
                            type="button"
                            role="radio"
                            aria-checked={date === preset.value}
                            onClick={() => navigate({ date: preset.value === today ? null : preset.value })}
                            className={cn('rounded-md px-3 py-1', date === preset.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>
                <DatePicker
                    value={date}
                    max={today}
                    onChange={(event) => DATE.test(event.target.value) && navigate({ date: event.target.value === today ? null : event.target.value })}
                    className="h-9 w-auto"
                    aria-label={t('dashboard.dates.pick')}
                />
                <nav aria-label={t('dashboard.scope.label')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm sm:ml-2">
                    {visibleCrumbs.map((crumb, index) => (
                        <span key={crumb.label} className="flex items-center gap-1">
                            {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                            {index === visibleCrumbs.length - 1 ? (
                                <span className="font-semibold" aria-current="page">
                                    {crumb.label}
                                </span>
                            ) : (
                                <Button variant="link" size="auto" type="button" className="text-primary hover:underline" onClick={() => navigate(crumb.params)}>
                                    {crumb.label}
                                </Button>
                            )}
                        </span>
                    ))}
                </nav>
            </div>

            {overview.loading && <LoadingState rows={8} />}
            {overview.error && <ErrorState message={overview.error} onRetry={overview.retry} />}

            {data && (
                <div className={cn('space-y-5 transition-opacity', overview.refreshing && 'opacity-70')}>
                    {data.students.expected === 0 && data.students.unknown === 0 && (
                        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{t('dashboard.noStats')}</p>
                    )}

                    <div className="grid gap-5 xl:grid-cols-2">
                        <KpiGroup
                            title={t('dashboard.series.students')}
                            kpi={data.students}
                            previous={data.previous?.students ?? null}
                            previousLabel={data.previousDate ? formatDate(data.previousDate) : null}
                            isToday={isToday}
                            hero
                        />
                        <KpiGroup
                            title={t('dashboard.series.teachers')}
                            kpi={data.teachers}
                            previous={data.previous?.teachers ?? null}
                            previousLabel={data.previousDate ? formatDate(data.previousDate) : null}
                            isToday={isToday}
                        />
                    </div>

                    {level === 'SCHOOL' ? (
                        <Panel title={t('dashboard.classes.title')} description={t('dashboard.classes.description')}>
                            <ClassGrid items={data.children} />
                        </Panel>
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                            <Panel title={t('dashboard.map.title')} description={t('dashboard.map.description')}>
                                <UzbekistanMap overview={data} canMapGeo={role === 'SUPER_ADMIN'} onSelect={selectChild} onGeoChanged={overview.retry} />
                            </Panel>
                            <Panel title={t('dashboard.ranking.title', { unit: unitLabel })}>
                                <RankingList items={data.children} onSelect={selectChild} unitLabel={unitLabel} />
                            </Panel>
                        </div>
                    )}

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <Panel title={t('dashboard.trend.title')} description={t('dashboard.trend.description')}>
                            {trend.loading ? <LoadingState rows={4} /> : trend.error ? <ErrorState message={trend.error} onRetry={trend.retry} /> : trend.data && <TrendChart points={trend.data.points} />}
                        </Panel>
                        <div className="space-y-5">
                            <Panel title={t('dashboard.shifts.title')}>
                                <ShiftSplit shifts={data.shifts} />
                            </Panel>
                            <Panel title={t('dashboard.health.title')}>
                                <SystemHealth overview={data} canOpenTerminals />
                            </Panel>
                        </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                        <Panel title={t('dashboard.arrivals.title')} description={t('dashboard.arrivals.description')}>
                            {arrivals.loading ? <LoadingState rows={4} /> : arrivals.error ? <ErrorState message={arrivals.error} onRetry={arrivals.retry} /> : arrivals.data && <ArrivalsChart data={arrivals.data} />}
                        </Panel>
                        <Panel title={t('dashboard.streaks.title')} description={t('dashboard.streaks.description')}>
                            <AbsenceStreaks key={scopeQuery} scopeQuery={scopeQuery} level={data.scope.level} viewAllTo={`/dashboard/absence-streaks?${scopeQuery}`} />
                        </Panel>
                    </div>

                    {data.schools.total > 0 && level !== 'SCHOOL' && (
                        <div className="flex justify-end">
                            <Button asChild variant="ghost" size="sm">
                                <a href={`/attendance?${scope.toString()}`}>{t('dashboard.openDetailed')}</a>
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
