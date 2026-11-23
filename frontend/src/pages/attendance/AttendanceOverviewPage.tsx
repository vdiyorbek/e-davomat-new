import { useState } from 'react';
import {
    CalendarOff,
    ChartNoAxesColumn,
    ChevronRight,
    CircleCheck,
    CircleX,
    FileCheck2,
    MapPinned,
    RotateCw,
    Search,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/attendance/summary/SummaryCard';
import { SummaryFilters } from '@/components/attendance/summary/SummaryFilters';
import type { PlaceFilters } from '@/components/attendance/summary/SummaryFilters';
import { KpiCard } from '@/components/common/KpiCard';
import type { KpiTone } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { isPeriod, periodRange, validateRange } from '@/lib/attendance-summary';
import type { Period } from '@/lib/attendance-summary';
import { academicYearFor, formatDate, formatNumber, formatTime, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';
import type {
    AttendanceSummary,
    SummaryBand,
    SummaryItem,
    SummaryLevel,
    SummaryMembershipType,
} from '@/types/attendance-summary';
import type { School } from '@/types/school';

type BandFilter = 'ALL' | SummaryBand | 'NONE';
type SortKey = 'rateAsc' | 'rateDesc' | 'name';

const BAND_FILTERS: BandFilter[] = ['ALL', 'LOW', 'MEDIUM', 'HIGH'];
const SORT_KEYS: SortKey[] = ['rateAsc', 'rateDesc', 'name'];
const ID_PATTERN = /^[1-9]\d{0,9}$/;

const BAND_DOT: Record<BandFilter, string> = {
    ALL: 'bg-primary',
    LOW: 'bg-destructive',
    MEDIUM: 'bg-warning',
    HIGH: 'bg-success',
    NONE: 'bg-muted-foreground',
};

function idParam(value: string | null): string {
    return value && ID_PATTERN.test(value) ? value : '';
}

function rateTone(band: SummaryBand | null): KpiTone {
    if (band === 'LOW') return 'danger';
    if (band === 'MEDIUM') return 'warning';
    if (band === 'HIGH') return 'success';
    return 'neutral';
}

interface ResultsProps {
    path: string;
    type: SummaryMembershipType;
    live: boolean;
    band: BandFilter;
    sort: SortKey;
    onBandChange: (band: BandFilter) => void;
    onSortChange: (sort: SortKey) => void;
    onOpen: (item: SummaryItem, level: SummaryLevel) => void;
    hasNextLevel: (level: SummaryLevel) => boolean;
}

function SummaryResults({ path, type, live, band, sort, onBandChange, onSortChange, onOpen, hasNextLevel }: ResultsProps) {
    const { t } = useTranslation();
    const { data, loading, refreshing, error, retry } = useApiQuery<AttendanceSummary>(path);
    const [search, setSearch] = useState('');

    // Bugungi kun ko‘rilayotgan bo‘lsa — har daqiqada yangilanadi.
    useInterval(retry, live ? 60_000 : null);

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {Array.from({ length: 6 }, (_, index) => (
                        <KpiCard key={index} label="" value={0} icon={Users} loading />
                    ))}
                </div>
                <LoadingState rows={6} />
            </div>
        );
    }

    if (error || !data) {
        return <ErrorState title={t('attendanceSummary.loadFailed')} message={error} onRetry={retry} />;
    }

    const { totals, level, bands } = data;
    const multiDay = data.days > 1;
    const personDaysHint = multiDay ? t('attendanceSummary.kpi.personDaysHint', { days: data.days }) : undefined;

    const itemTitle = (item: SummaryItem) =>
        item.name ?? (level === 'CLASS' && item.id === 0 ? t('attendanceSummary.noClass') : `#${item.id}`);

    const itemSubtitle = (item: SummaryItem) =>
        level === 'CLASS'
            ? item.gradeLevel
                ? t('calendar.gradeN', { grade: item.gradeLevel })
                : null
            : item.subtitle;

    const bandCounts: Record<BandFilter, number> = {
        ALL: data.items.length,
        LOW: data.items.filter((item) => item.band === 'LOW').length,
        MEDIUM: data.items.filter((item) => item.band === 'MEDIUM').length,
        HIGH: data.items.filter((item) => item.band === 'HIGH').length,
        NONE: data.items.filter((item) => item.band === null).length,
    };

    const needle = search.trim().toLocaleLowerCase();

    const visible = data.items
        .filter((item) => band === 'ALL' || (band === 'NONE' ? item.band === null : item.band === band))
        .filter((item) => !needle || itemTitle(item).toLocaleLowerCase().includes(needle))
        .sort((a, b) => {
            const byName = itemTitle(a).localeCompare(itemTitle(b), undefined, { numeric: true });
            if (sort === 'name') return byName;
            // Ma’lumoti yo‘qlar har doim oxirida.
            const ra = a.rate ?? (sort === 'rateAsc' ? Infinity : -Infinity);
            const rb = b.rate ?? (sort === 'rateAsc' ? Infinity : -Infinity);
            return (sort === 'rateAsc' ? ra - rb : rb - ra) || byName;
        });

    const kpis: { key: string; value: number | string; icon: typeof Users; tone: KpiTone; hint?: string }[] = [
        { key: 'persons', value: totals.persons, icon: Users, tone: 'primary' },
        { key: 'present', value: totals.present, icon: CircleCheck, tone: 'success', hint: personDaysHint },
        { key: 'absent', value: totals.absent, icon: CircleX, tone: 'danger', hint: personDaysHint },
        { key: 'excused', value: totals.excused, icon: FileCheck2, tone: 'primary', hint: personDaysHint },
        { key: 'dayOff', value: totals.dayOff, icon: CalendarOff, tone: 'neutral', hint: personDaysHint },
        {
            key: 'rate',
            value: totals.rate === null ? '—' : `${formatNumber(totals.rate)}%`,
            icon: ChartNoAxesColumn,
            tone: rateTone(totals.band),
            hint: t('attendanceSummary.kpi.rateHint'),
        },
    ];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {kpis.map((kpi) => (
                    <KpiCard
                        key={kpi.key}
                        label={t(`attendanceSummary.kpi.${kpi.key}`)}
                        value={kpi.value}
                        icon={kpi.icon}
                        tone={kpi.tone}
                        {...(kpi.hint ? { hint: kpi.hint } : {})}
                    />
                ))}
            </div>

            {totals.unknown > 0 && (
                <p
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm"
                >
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                    {t('attendanceSummary.unknownWarning', { count: totals.unknown, formatted: formatNumber(totals.unknown) })}
                </p>
            )}

            <section aria-labelledby="summary-items-title" className="space-y-4">
                {/* Sarlavha va boshqaruvlar */}
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <h2 id="summary-items-title" className="font-heading text-lg font-bold">
                            {t(`attendanceSummary.level.${level}`)}{' '}
                            <span className="font-normal text-muted-foreground tabular-nums">({data.items.length})</span>
                        </h2>
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>
                                {data.from === data.to
                                    ? formatDate(data.from)
                                    : `${formatDate(data.from)} — ${formatDate(data.to)}`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1.5">
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        refreshing ? 'animate-pulse bg-primary' : live ? 'bg-success' : 'bg-muted-foreground',
                                    )}
                                />
                                {t('attendanceSummary.updatedAt', { time: formatTime(data.generatedAt) })}
                                {live && ` · ${t('attendanceSummary.autoRefresh')}`}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {data.items.length > 6 && (
                            <div className="relative sm:w-56">
                                <Search
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('attendanceSummary.searchPlaceholder')}
                                    aria-label={t('attendanceSummary.search')}
                                    className="h-10 pl-9"
                                />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <SelectField
                                value={sort}
                                onValueChange={(value) => onSortChange(value as SortKey)}
                                options={SORT_KEYS.map((key) => ({ value: key, label: t(`attendanceSummary.sort.${key}`) }))}
                                aria-label={t('attendanceSummary.sort.label')}
                                className="h-10 min-w-0 flex-1 sm:w-48 sm:flex-none"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-10 shrink-0 bg-card"
                                onClick={retry}
                                disabled={refreshing}
                                aria-label={t('attendanceSummary.refresh')}
                                title={t('attendanceSummary.refresh')}
                            >
                                <RotateCw aria-hidden="true" className={cn(refreshing && 'animate-spin')} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Davomat darajasi bo‘yicha filtr */}
                <div
                    role="group"
                    aria-label={t('attendanceSummary.bandFilter')}
                    className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
                >
                    {[...BAND_FILTERS, ...(bandCounts.NONE > 0 ? (['NONE'] as const) : [])].map((key) => {
                        const active = band === key;
                        const range =
                            key === 'LOW' || key === 'MEDIUM' || key === 'HIGH'
                                ? t(`attendanceSummary.bandRange.${key}`, { low: bands.lowBelow, high: bands.highAbove })
                                : null;

                        return (
                            <Button variant="link" size="auto"
                                key={key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onBandChange(key)}
                                className={cn(
                                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'bg-card text-foreground hover:bg-muted',
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn('size-2 rounded-full', active ? 'bg-primary-foreground' : BAND_DOT[key])}
                                />
                                {t(`attendanceSummary.bands.${key}`)}
                                {range && <span className={cn(!active && 'text-muted-foreground')}>{range}</span>}
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 tabular-nums',
                                        active ? 'bg-primary-foreground/20' : 'bg-muted',
                                    )}
                                >
                                    {bandCounts[key]}
                                </span>
                            </Button>
                        );
                    })}
                </div>

                {data.items.length === 0 ? (
                    <EmptyState
                        icon={MapPinned}
                        title={t('attendanceSummary.emptyTitle')}
                        description={t('attendanceSummary.empty')}
                    />
                ) : visible.length === 0 ? (
                    <EmptyState icon={Search} title={t('attendanceSummary.noMatch')} />
                ) : (
                    <ul className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visible.map((item) => (
                            <li key={item.id}>
                                <SummaryCard
                                    item={item}
                                    title={itemTitle(item)}
                                    subtitle={itemSubtitle(item)}
                                    membershipType={type}
                                    actionLabel={
                                        hasNextLevel(level)
                                            ? t('attendanceSummary.drill')
                                            : t('attendanceSummary.openList')
                                    }
                                    onOpen={() => onOpen(item, level)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

export function AttendanceOverviewPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const role = session?.profile.role;
    const today = todayInTashkent();

    const type: SummaryMembershipType = searchParams.get('type') === 'teachers' ? 'TEACHER' : 'STUDENT';
    const periodValue = searchParams.get('period');
    const period: Period = isPeriod(periodValue) ? periodValue : 'today';

    const range = periodRange(period, today) ?? {
        from: searchParams.get('from') ?? today,
        to: searchParams.get('to') ?? today,
    };
    const rangeError = validateRange(range.from, range.to, today);

    const place: PlaceFilters = {
        regionId: idParam(searchParams.get('regionId')),
        districtId: idParam(searchParams.get('districtId')),
        schoolId: idParam(searchParams.get('schoolId')),
        classId: type === 'STUDENT' ? idParam(searchParams.get('classId')) : '',
    };

    const bandValue = searchParams.get('band');
    const band: BandFilter = (BAND_FILTERS as string[]).includes(bandValue ?? '') || bandValue === 'NONE'
        ? (bandValue as BandFilter)
        : 'ALL';
    const sortValue = searchParams.get('sort');
    const sort: SortKey = (SORT_KEYS as string[]).includes(sortValue ?? '') ? (sortValue as SortKey) : 'rateAsc';

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data;

    function update(patch: Record<string, string>, resetView = true) {
        const next = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
        }
        // Boshqa kesimga o‘tganda daraja filtri tozalanadi.
        if (resetView) next.delete('band');
        setSearchParams(next);
    }

    function changeType(nextType: SummaryMembershipType) {
        update({ type: nextType === 'TEACHER' ? 'teachers' : '', classId: '' });
    }

    function changePeriod(nextPeriod: Period) {
        if (nextPeriod === 'custom') {
            update({ period: 'custom', from: range.from, to: range.to }, false);
        } else {
            update({ period: nextPeriod === 'today' ? '' : nextPeriod, from: '', to: '' }, false);
        }
    }

    /** Ro‘yxat sahifasiga o‘tish (oxirgi kesim). */
    function openList(extra: Partial<PlaceFilters>) {
        const target = { ...place, ...extra };
        const params = new URLSearchParams({ date: range.to });
        for (const key of ['regionId', 'districtId', 'schoolId', 'classId'] as const) {
            if (target[key]) params.set(key, target[key]);
        }
        navigate(`/attendance/${type === 'STUDENT' ? 'students' : 'teachers'}?${params.toString()}`);
    }

    function hasNextLevel(level: SummaryLevel) {
        if (level === 'CLASS') return false;
        if (level === 'SCHOOL') return type === 'STUDENT';
        return true;
    }

    function openItem(item: SummaryItem, level: SummaryLevel) {
        const id = String(item.id);
        switch (level) {
            case 'REGION':
                update({ regionId: id, districtId: '', schoolId: '', classId: '' });
                break;
            case 'DISTRICT':
                update({ districtId: id, schoolId: '', classId: '' });
                break;
            case 'SCHOOL':
                if (type === 'STUDENT') update({ schoolId: id, classId: '' });
                else openList({ schoolId: id });
                break;
            case 'CLASS':
                openList({ classId: item.id === 0 ? '' : id });
                break;
        }
    }

    // Yo‘l ko‘rsatkichi (breadcrumb): tanlangan hudud nomlari maktablar ro‘yxatidan olinadi.
    const schoolList = schools ?? [];
    const regionName = schoolList.find((school) => String(school.district.region.id) === place.regionId)?.district.region.name;
    const districtName = schoolList.find((school) => String(school.districtId) === place.districtId)?.district.name;
    const schoolName = schoolList.find((school) => String(school.id) === place.schoolId)?.name;

    const crumbs: { label: string; patch: Record<string, string> }[] = [];
    if (place.regionId) crumbs.push({ label: regionName ?? `#${place.regionId}`, patch: { districtId: '', schoolId: '', classId: '' } });
    if (place.districtId) crumbs.push({ label: districtName ?? `#${place.districtId}`, patch: { schoolId: '', classId: '' } });
    if (place.schoolId) crumbs.push({ label: schoolName ?? `#${place.schoolId}`, patch: { classId: '' } });

    const query = new URLSearchParams({ membershipType: type, from: range.from, to: range.to });
    for (const key of ['regionId', 'districtId', 'schoolId', 'classId'] as const) {
        if (place[key]) query.set(key, place[key]);
    }
    const path = `/daily-attendance/summary?${query.toString()}`;

    return (
        <div className="w-full min-w-0 space-y-5 sm:space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.attendance')}
                title={t('attendanceSummary.title')}
                description={t('attendanceSummary.subtitle')}
            />

            <SummaryFilters
                type={type}
                onTypeChange={changeType}
                period={period}
                onPeriodChange={changePeriod}
                from={range.from}
                to={range.to}
                today={today}
                onRangeChange={(from, to) => update({ period: 'custom', from, to }, false)}
                rangeError={rangeError}
                place={place}
                onPlaceChange={(patch) => update(patch)}
                schools={schools}
                schoolsLoading={schoolsQuery.loading}
                academicYear={academicYearFor(range.to)}
            />

            {(crumbs.length > 0 || place.classId) && role !== 'SCHOOL_ADMIN' && (
                <nav aria-label={t('attendanceSummary.breadcrumbLabel')}>
                    <ol className="flex flex-wrap items-center gap-1 text-sm">
                        <li>
                            <Button variant="link" size="auto"
                                type="button"
                                onClick={() => update({ regionId: '', districtId: '', schoolId: '', classId: '' })}
                                className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
                            >
                                {t('attendanceSummary.breadcrumbRoot')}
                            </Button>
                        </li>
                        {crumbs.map((crumb, index) => {
                            const last = index === crumbs.length - 1 && !place.classId;
                            return (
                                <li key={crumb.label} className="flex items-center gap-1">
                                    <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                                    {last ? (
                                        <span aria-current="page" className="px-1.5 font-semibold">
                                            {crumb.label}
                                        </span>
                                    ) : (
                                        <Button variant="link" size="auto"
                                            type="button"
                                            onClick={() => update(crumb.patch)}
                                            className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
                                        >
                                            {crumb.label}
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>
            )}

            {rangeError ? null : (
                <SummaryResults
                    key={path}
                    path={path}
                    type={type}
                    live={range.to === today}
                    band={band}
                    sort={sort}
                    onBandChange={(next) => update({ band: next === 'ALL' ? '' : next }, false)}
                    onSortChange={(next) => update({ sort: next === 'rateAsc' ? '' : next }, false)}
                    onOpen={openItem}
                    hasNextLevel={hasNextLevel}
                />
            )}
        </div>
    );
}
