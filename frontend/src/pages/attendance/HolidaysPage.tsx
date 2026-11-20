import { useId, useState } from 'react';
import { Ban, CalendarOff, CalendarRange, GraduationCap, Landmark, Presentation, RotateCw, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { CreateHolidayDialog } from '@/components/attendance/holidays/CreateHolidayDialog';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { FilterToggle } from '@/components/common/FilterToggle';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { daysInRange } from '@/lib/attendance-summary';
import { authorizedPatch } from '@/lib/auth-session';
import { formatDate, formatDateTime, todayInTashkent } from '@/lib/date';
import { holidayTiming } from '@/lib/holidays';
import type { HolidayTiming } from '@/lib/holidays';
import { DEFAULT_PAGE_SIZE, parsePageSize } from '@/lib/pagination';
import type { HolidayAppliesTo, HolidayRule, HolidayRulesPage } from '@/types/holiday';

type AudienceTab = 'all' | 'STUDENT' | 'TEACHER';

const SCOPES = ['GLOBAL', 'REGION', 'DISTRICT', 'SCHOOL'] as const;
const DAY_TYPES = ['DAY_OFF', 'WORK_DAY'] as const;

const AUDIENCE_TONES: Record<HolidayAppliesTo, StatusTone> = {
    STUDENT: 'info',
    TEACHER: 'primary',
    BOTH: 'success',
};

const TIMING_TONES: Record<HolidayTiming, StatusTone> = {
    past: 'neutral',
    current: 'success',
    upcoming: 'info',
};

function readAudience(value: string | null): AudienceTab {
    return value === 'STUDENT' || value === 'TEACHER' ? value : 'all';
}

function readOneOf<T extends string>(value: string | null, list: readonly T[]): T | '' {
    return value && (list as readonly string[]).includes(value) ? (value as T) : '';
}

function readPositive(value: string | null, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Sana oralig‘i: ikki qatorda, kunlar soni bilan — jadvaldan chiqib ketmaydi. */
function RangeBadge({ rule }: { rule: HolidayRule }) {
    const { t } = useTranslation();
    const single = rule.startDate === rule.endDate;

    return (
        <div className="inline-flex max-w-full items-start gap-2 rounded-xl border bg-muted/40 px-2.5 py-1.5">
            <CalendarRange aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm leading-5 tabular-nums">
                <p className="whitespace-nowrap">
                    {formatDate(rule.startDate)}
                    {!single && <span className="text-muted-foreground"> —</span>}
                </p>
                {!single && <p className="whitespace-nowrap">{formatDate(rule.endDate)}</p>}
                <p className="text-xs text-muted-foreground">{t('holidays.daysCount', { count: daysInRange(rule.startDate, rule.endDate) })}</p>
            </div>
        </div>
    );
}

export function HolidaysPage({ embedded = false }: { embedded?: boolean } = {}) {
    const { t } = useTranslation();
    const ids = useId();
    const { confirm, dialog } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();

    const today = todayInTashkent();
    const currentYear = Number(today.slice(0, 4));
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    const audience = readAudience(searchParams.get('audience'));
    const yearParam = Number(searchParams.get('year'));
    const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : currentYear;
    const scope = readOneOf(searchParams.get('scope'), SCOPES);
    const dayType = readOneOf(searchParams.get('dayType'), DAY_TYPES);
    const page = readPositive(searchParams.get('page'), 1);
    const limit = parsePageSize(searchParams.get('limit')) ?? DEFAULT_PAGE_SIZE;

    const advancedCount = [scope, dayType].filter(Boolean).length;
    const [expanded, setExpanded] = useState(advancedCount > 0);
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');

    const query = new URLSearchParams({ year: String(year), page: String(page), limit: String(limit) });
    if (audience !== 'all') query.set('appliesTo', audience);
    if (scope) query.set('scopeType', scope);
    if (dayType) query.set('dayType', dayType);

    const { data, loading, error, retry } = useApiQuery<HolidayRulesPage>(`/attendance-calendar/rules/list?${query.toString()}`);

    function update(changes: Record<string, string>, resetPage = true) {
        const next = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
        }
        if (resetPage) next.set('page', '1');
        setSearchParams(next);
    }

    function clearFilters() {
        const next = new URLSearchParams(searchParams);
        ['scope', 'dayType', 'year'].forEach((key) => next.delete(key));
        next.set('page', '1');
        setSearchParams(next);
    }

    async function handleCancel(rule: HolidayRule) {
        if (cancellingId !== null || !rule.canCancel) return;
        const confirmed = await confirm({
            title: t('holidays.cancelTitle'),
            description: t('holidays.cancelConfirm', { reason: rule.reason }),
            confirmLabel: t('holidays.cancel'),
            destructive: true,
        });
        if (!confirmed) return;

        setNotice('');
        setActionError('');
        setCancellingId(rule.id);
        try {
            await authorizedPatch(`/attendance-calendar/rules/${rule.id}/cancel`, {});
            setNotice(t('holidays.cancelled'));
            retry();
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : t('holidays.cancelFailed'));
        } finally {
            setCancellingId(null);
        }
    }

    function placeBlock(rule: HolidayRule) {
        const name =
            rule.scopeType === 'GLOBAL'
                ? t('holidays.national')
                : rule.scopeType === 'REGION'
                  ? rule.region?.name
                  : rule.scopeType === 'DISTRICT'
                    ? rule.district?.name
                    : rule.school?.name;

        return (
            <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {rule.scopeType === 'GLOBAL' && <Landmark aria-hidden="true" className="size-3.5" />}
                    {t(`holidays.scopes.${rule.scopeType}`)}
                </p>
                <p className="text-sm [overflow-wrap:anywhere]">{name ?? '—'}</p>
                {rule.schoolClass && <p className="text-xs text-muted-foreground">{rule.schoolClass.name}</p>}
            </div>
        );
    }

    function reasonBlock(rule: HolidayRule) {
        return (
            <div className="min-w-0 space-y-1">
                <p className="leading-6 font-semibold [overflow-wrap:anywhere]">{rule.reason}</p>
                <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={rule.dayType === 'DAY_OFF' ? 'warning' : 'success'}>{t(`holidays.dayTypes.${rule.dayType}`)}</StatusBadge>
                    {rule.isMandatory && <StatusBadge tone="danger">{t('holidays.mandatory')}</StatusBadge>}
                </div>
            </div>
        );
    }

    function audienceBadge(rule: HolidayRule) {
        return <StatusBadge tone={AUDIENCE_TONES[rule.appliesTo]}>{t(`holidays.audiences.${rule.appliesTo}`)}</StatusBadge>;
    }

    function timingBadge(rule: HolidayRule) {
        const timing = holidayTiming(rule, today);
        return (
            <StatusBadge tone={TIMING_TONES[timing]} dot={timing === 'current'}>
                {t(`holidays.timing.${timing}`)}
            </StatusBadge>
        );
    }

    function createdBlock(rule: HolidayRule) {
        return (
            <div className="min-w-0 text-sm">
                <p className="[overflow-wrap:anywhere]">{rule.createdBy?.name ?? '—'}</p>
                <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(rule.createdAt)}</p>
            </div>
        );
    }

    function cancelButton(rule: HolidayRule) {
        if (!rule.canCancel) return <span className="text-xs text-muted-foreground">{t('holidays.viewOnly')}</span>;
        const busy = cancellingId === rule.id;
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={cancellingId !== null}
                onClick={() => void handleCancel(rule)}
            >
                <Ban aria-hidden="true" />
                {busy ? t('holidays.cancelling') : t('holidays.cancel')}
            </Button>
        );
    }

    const hasFilters = Boolean(scope || dayType || year !== currentYear);

    return (
        <div className="space-y-6">
            {dialog}
            {embedded ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-2xl text-sm text-muted-foreground">{t('holidays.subtitle')}</p>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <>
                        <CreateHolidayDialog
                            onCreated={() => {
                                setActionError('');
                                setNotice(t('holidays.created'));
                                retry();
                            }}
                        />
                        <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={retry}>
                            <RotateCw aria-hidden="true" />
                        </Button>
                    </>
                    </div>
                </div>
            ) : (
                <PageHeader
                    eyebrow={t('nav.groups.attendance')}
                    title={t('holidays.title')}
                    description={t('holidays.subtitle')}
                    actions={
                        <>
                            <CreateHolidayDialog
                                onCreated={() => {
                                    setActionError('');
                                    setNotice(t('holidays.created'));
                                    retry();
                                }}
                            />
                            <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={retry}>
                                <RotateCw aria-hidden="true" />
                            </Button>
                        </>
                    }
                />
            )}

            <section aria-label={t('common.filters')} className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">{t('holidays.audience')}</p>
                        <Tabs value={audience} onValueChange={(value) => update({ audience: value === 'all' ? '' : value })}>
                            <TabsList aria-label={t('holidays.audience')} className="w-full sm:w-fit">
                                <TabsTrigger value="all" className="px-3">
                                    <Users aria-hidden="true" />
                                    {t('holidays.audiences.ALL')}
                                </TabsTrigger>
                                <TabsTrigger value="STUDENT" className="px-3">
                                    <GraduationCap aria-hidden="true" />
                                    {t('holidays.audiences.STUDENT')}
                                </TabsTrigger>
                                <TabsTrigger value="TEACHER" className="px-3">
                                    <Presentation aria-hidden="true" />
                                    {t('holidays.audiences.TEACHER')}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 md:w-auto">
                        <Field htmlFor={`${ids}-year`} label={t('holidays.year')} className="md:w-36">
                            <SelectField
                                id={`${ids}-year`}
                                value={String(year)}
                                onValueChange={(value) => update({ year: value === String(currentYear) ? '' : value })}
                                options={yearOptions.map((value) => ({ value: String(value), label: String(value) }))}
                            />
                        </Field>
                        <FilterToggle
                            expanded={expanded}
                            count={advancedCount}
                            controls={`${ids}-advanced`}
                            onToggle={() => setExpanded((value) => !value)}
                        />
                    </div>
                </div>

                <div id={`${ids}-advanced`} hidden={!expanded} className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                    <Field htmlFor={`${ids}-scope`} label={t('holidays.form.scope')}>
                        <SelectField
                            id={`${ids}-scope`}
                            value={scope}
                            onValueChange={(value) => update({ scope: value })}
                            emptyOption={t('holidays.allScopes')}
                            options={SCOPES.map((value) => ({ value, label: t(`holidays.scopes.${value}`) }))}
                        />
                    </Field>
                    <Field htmlFor={`${ids}-dayType`} label={t('holidays.form.dayType')}>
                        <SelectField
                            id={`${ids}-dayType`}
                            value={dayType}
                            onValueChange={(value) => update({ dayType: value })}
                            emptyOption={t('holidays.allDayTypes')}
                            options={DAY_TYPES.map((value) => ({ value, label: t(`holidays.dayTypes.${value}`) }))}
                        />
                    </Field>
                </div>

                {hasFilters && (
                    <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                            <X aria-hidden="true" />
                            {t('common.clearFilters')}
                        </Button>
                    </div>
                )}
            </section>

            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {actionError && <ErrorState message={actionError} />}

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-bold">{t('holidays.listTitle', { year })}</h2>
                    {data && <span className="text-sm text-muted-foreground">{t('common.total', { count: data.total })}</span>}
                </div>

                {loading ? (
                    <LoadingState />
                ) : error || !data ? (
                    <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
                ) : data.data.length === 0 ? (
                    <EmptyState icon={CalendarOff} title={t('holidays.emptyTitle')} description={t('holidays.empty')} />
                ) : (
                    <>
                        {/* Mobil va planshet: kartalar */}
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {data.data.map((rule) => (
                                <li key={rule.id}>
                                    <Card size="sm" className="h-full gap-3 px-4">
                                        <div className="flex items-start justify-between gap-3">
                                            {reasonBlock(rule)}
                                            {timingBadge(rule)}
                                        </div>
                                        <div className="flex flex-wrap items-start gap-3">
                                            <RangeBadge rule={rule} />
                                            <div className="min-w-0 flex-1 space-y-2">
                                                {audienceBadge(rule)}
                                                {placeBlock(rule)}
                                            </div>
                                        </div>
                                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                                            {createdBlock(rule)}
                                            {cancelButton(rule)}
                                        </div>
                                    </Card>
                                </li>
                            ))}
                        </ul>

                        {/* Katta ekran: jadval */}
                        <Card className="hidden py-0 xl:flex">
                            <Table className="min-w-[1040px] table-fixed">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-12 pl-5">{t('common.number')}</TableHead>
                                        <TableHead className="w-40">{t('holidays.period')}</TableHead>
                                        <TableHead className="w-[24%]">{t('holidays.form.reason')}</TableHead>
                                        <TableHead className="w-32">{t('holidays.audience')}</TableHead>
                                        <TableHead className="w-[18%]">{t('holidays.place')}</TableHead>
                                        <TableHead className="w-[14%]">{t('holidays.createdBy')}</TableHead>
                                        <TableHead className="w-32">{t('common.status')}</TableHead>
                                        <TableHead className="w-36 pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.data.map((rule, index) => (
                                        <TableRow key={rule.id} className="align-top">
                                            <TableCell className="pt-4 pl-5 text-muted-foreground tabular-nums">
                                                {(data.page - 1) * data.limit + index + 1}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <RangeBadge rule={rule} />
                                            </TableCell>
                                            <TableCell className="whitespace-normal">{reasonBlock(rule)}</TableCell>
                                            <TableCell className="pt-4">{audienceBadge(rule)}</TableCell>
                                            <TableCell className="whitespace-normal">{placeBlock(rule)}</TableCell>
                                            <TableCell className="whitespace-normal">{createdBlock(rule)}</TableCell>
                                            <TableCell className="pt-4">{timingBadge(rule)}</TableCell>
                                            <TableCell className="pr-5 text-right">{cancelButton(rule)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                )}

                {data && data.total > 0 && (
                    <Pagination
                        page={data.page}
                        totalPages={Math.max(1, data.totalPages)}
                        onPageChange={(next) => update({ page: String(next) }, false)}
                        onPageSizeChange={(size) => update({ limit: String(size) })}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.data.length}
                    />
                )}
            </section>
        </div>
    );
}
