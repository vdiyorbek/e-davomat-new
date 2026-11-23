import { useId, useState } from 'react';
import { CalendarRange, FileCheck2, GraduationCap, Hourglass, Presentation, RotateCw, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AttendanceExcuseActions } from '@/components/attendance/AttendanceExcuseActions';
import { CreateAttendanceExcuseDialog } from '@/components/attendance/CreateAttendanceExcuseDialog';
import { Field } from '@/components/common/Field';
import { FilterSearchForm } from '@/components/common/FilterSearchForm';
import { FilterToggle } from '@/components/common/FilterToggle';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { daysInRange, isIsoDate } from '@/lib/attendance-summary';
import { formatDate, formatDateTime } from '@/lib/date';
import { DEFAULT_PAGE_SIZE, parsePageSize } from '@/lib/pagination';
import { personFullName } from '@/lib/person';
import type { AttendanceExcuse, AttendanceExcusesPageResponse, ExcuseReason } from '@/types/attendance-excuse';
import type { School } from '@/types/school';
import { DatePicker } from '@/components/common/DatePicker';

type ExcuseType = 'STUDENT' | 'TEACHER';
type StatusFilter = 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'REJECTED' | 'all';

const FILTER_KEYS = ['schoolId', 'status', 'q', 'from', 'to'] as const;

const REASON_TONES: Record<ExcuseReason, 'danger' | 'info' | 'warning' | 'neutral'> = {
    ILLNESS: 'danger',
    OLYMPIAD: 'info',
    FAMILY: 'warning',
    OTHER: 'neutral',
};

function readType(value: string | null): ExcuseType {
    return value === 'TEACHER' ? 'TEACHER' : 'STUDENT';
}

function readStatus(value: string | null): StatusFilter {
    return value === 'CANCELLED' || value === 'PENDING' || value === 'REJECTED' || value === 'all' ? value : 'ACTIVE';
}

function readPositive(value: string | null, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Sana oralig‘i: ikki qatorda, kunlar soni bilan — jadval kengayib ketmaydi. */
function PeriodBadge({ item }: { item: AttendanceExcuse }) {
    const { t } = useTranslation();
    const days = daysInRange(item.startDate, item.endDate);
    const single = item.startDate === item.endDate;

    return (
        <div className="inline-flex max-w-full items-start gap-2 rounded-xl border bg-muted/40 px-2.5 py-1.5">
            <CalendarRange aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm leading-5 tabular-nums">
                <p className="whitespace-nowrap">
                    {formatDate(item.startDate)}
                    {!single && <span className="text-muted-foreground"> —</span>}
                </p>
                {!single && <p className="whitespace-nowrap">{formatDate(item.endDate)}</p>}
                <p className="text-xs text-muted-foreground">{t('excuses.daysCount', { count: days })}</p>
            </div>
        </div>
    );
}

export function AttendanceExcusesPage() {
    const { t } = useTranslation();
    const ids = useId();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const role = session?.profile.role;
    const canChooseSchool = role === 'SUPER_ADMIN';

    const type = readType(searchParams.get('type'));
    const status = readStatus(searchParams.get('status'));
    const schoolId = searchParams.get('schoolId') ?? '';
    const search = searchParams.get('q') ?? '';
    const fromParam = searchParams.get('from') ?? '';
    const toParam = searchParams.get('to') ?? '';
    const from = isIsoDate(fromParam) ? fromParam : '';
    const to = isIsoDate(toParam) ? toParam : '';
    const page = readPositive(searchParams.get('page'), 1);
    const limit = parsePageSize(searchParams.get('limit')) ?? DEFAULT_PAGE_SIZE;

    const advancedCount = [schoolId, from, to, status !== 'ACTIVE' ? status : ''].filter(Boolean).length;
    const [expanded, setExpanded] = useState(advancedCount > 0);
    const rangeInvalid = Boolean(from && to && from > to);

    const { data: schools, loading: schoolsLoading } = useApiQuery<School[]>('/schools');

    const query = new URLSearchParams({ page: String(page), limit: String(limit), membershipType: type });
    if (schoolId) query.set('schoolId', schoolId);
    if (status !== 'all') query.set('status', status);
    if (search.length >= 2) query.set('q', search);
    if (!rangeInvalid) {
        if (from) query.set('from', from);
        if (to) query.set('to', to);
    }

    const { data, loading, error, retry } = useApiQuery<AttendanceExcusesPageResponse>(`/attendance-excuses?${query.toString()}`);

    // Tasdiqlashni kutayotgan arizalar soni (sinf rahbarlari yuborgan).
    const pendingQuery = new URLSearchParams({ page: '1', limit: '1', membershipType: 'STUDENT', status: 'PENDING' });
    if (schoolId) pendingQuery.set('schoolId', schoolId);
    const pending = useApiQuery<AttendanceExcusesPageResponse>(`/attendance-excuses?${pendingQuery.toString()}`);
    const pendingCount = pending.data?.total ?? 0;

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
        FILTER_KEYS.forEach((key) => next.delete(key));
        next.set('page', '1');
        setSearchParams(next);
    }

    const hasFilters = Boolean(schoolId || search || from || to || status !== 'ACTIVE');
    const isTeacher = type === 'TEACHER';

    function statusBadge(item: AttendanceExcuse) {
        return (
            <div className="min-w-0 space-y-1">
                <StatusBadge
                    tone={item.status === 'ACTIVE' ? 'success' : item.status === 'PENDING' ? 'warning' : item.status === 'REJECTED' ? 'danger' : 'neutral'}
                >
                    {t(`excuses.status.${item.status}`)}
                </StatusBadge>
                {item.status === 'REJECTED' && item.rejectionReason && (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]" title={item.rejectionReason}>
                        {t('excuses.rejectedReason', { reason: item.rejectionReason })}
                    </p>
                )}
            </div>
        );
    }

    function reasonBlock(item: AttendanceExcuse) {
        return (
            <div className="min-w-0 space-y-1">
                <StatusBadge tone={REASON_TONES[item.reason]}>{t(`excuses.reason.${item.reason}`)}</StatusBadge>
                {item.reasonNote && (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]" title={item.reasonNote}>
                        {item.reasonNote}
                    </p>
                )}
            </div>
        );
    }

    function personBlock(item: AttendanceExcuse) {
        return (
            <div className="min-w-0">
                <Link
                    to={`/persons/${item.personId}`}
                    className="font-semibold leading-6 underline-offset-4 [overflow-wrap:anywhere] hover:text-primary hover:underline"
                >
                    {personFullName(item.person, t('common.personMissing'))}
                </Link>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {item.person?.pnfl ? `${t('common.pnfl')}: ${item.person.pnfl}` : t('excuses.number', { id: item.id })}
                </p>
            </div>
        );
    }

    function uploadedBlock(item: AttendanceExcuse) {
        return (
            <div className="min-w-0 text-sm">
                <p className="[overflow-wrap:anywhere]">{item.uploadedBy?.name ?? '—'}</p>
                <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.attendance')}
                title={t('excuses.title')}
                description={t('excuses.subtitleBoth')}
                actions={
                    <>
                        <CreateAttendanceExcuseDialog
                            key={type}
                            membershipType={type}
                            onSaved={() => {
                                update({ status: '' });
                                retry();
                            }}
                        />
                        <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={retry}>
                            <RotateCw aria-hidden="true" />
                        </Button>
                    </>
                }
            />

            {pendingCount > 0 && status !== 'PENDING' && (
                <Alert className="border-warning/40 bg-warning/10">
                    <Hourglass aria-hidden="true" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
                        <span>{t('excuses.pendingBanner', { count: pendingCount })}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => update({ status: 'PENDING', type: '' })}>
                            {t('excuses.viewPending')}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={type} onValueChange={(value) => update({ type: value === 'TEACHER' ? 'TEACHER' : '' })}>
                <TabsList aria-label={t('excuses.typeLabel')} className="w-full sm:w-fit">
                    <TabsTrigger value="STUDENT" className="px-4">
                        <GraduationCap aria-hidden="true" />
                        {t('excuses.types.STUDENT')}
                    </TabsTrigger>
                    <TabsTrigger value="TEACHER" className="px-4">
                        <Presentation aria-hidden="true" />
                        {t('excuses.types.TEACHER')}
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <section aria-label={t('common.filters')} className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <FilterSearchForm
                        key={search}
                        label={isTeacher ? t('excuses.filters.searchTeacher') : t('excuses.filters.searchStudent')}
                        placeholder={t('excuses.filters.searchPlaceholder')}
                        initialValue={search}
                        onSearch={(value) => update({ q: value.length >= 2 ? value : '' })}
                    />
                    <FilterToggle
                        expanded={expanded}
                        count={advancedCount}
                        controls={`${ids}-advanced`}
                        onToggle={() => setExpanded((value) => !value)}
                    />
                </div>

                <div
                    id={`${ids}-advanced`}
                    hidden={!expanded}
                    className={`grid gap-4 border-t pt-4 sm:grid-cols-2 ${canChooseSchool ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}
                >
                    {canChooseSchool && (
                        <Field htmlFor={`${ids}-school`} label={t('common.school')}>
                            <SelectField
                                id={`${ids}-school`}
                                value={schoolId}
                                searchable
                                disabled={schoolsLoading}
                                onValueChange={(value) => update({ schoolId: value })}
                                emptyOption={t('filters.allSchools')}
                                options={(schools ?? []).map((school) => ({
                                    value: String(school.id),
                                    label: school.name,
                                    keywords: `${school.name} ${school.district.name}`,
                                }))}
                            />
                        </Field>
                    )}
                    <Field htmlFor={`${ids}-status`} label={t('excuses.filters.status')}>
                        <SelectField
                            id={`${ids}-status`}
                            value={status}
                            onValueChange={(value) => update({ status: value === 'ACTIVE' ? '' : value })}
                            options={[
                                { value: 'ACTIVE', label: t('excuses.status.ACTIVE') },
                                { value: 'PENDING', label: t('excuses.status.PENDING') },
                                { value: 'REJECTED', label: t('excuses.status.REJECTED') },
                                { value: 'CANCELLED', label: t('excuses.status.CANCELLED') },
                                { value: 'all', label: t('excuses.filters.all') },
                            ]}
                        />
                    </Field>
                    <Field htmlFor={`${ids}-from`} label={t('excuses.filters.from')}>
                        <DatePicker id={`${ids}-from`} value={from} max={to || undefined} onChange={(event) => update({ from: event.target.value })} />
                    </Field>
                    <Field
                        htmlFor={`${ids}-to`}
                        label={t('excuses.filters.to')}
                        error={rangeInvalid ? t('excuses.errors.range') : undefined}
                    >
                        <DatePicker id={`${ids}-to`} value={to} min={from || undefined} onChange={(event) => update({ to: event.target.value })} />
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

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-bold">
                        {isTeacher ? t('excuses.listTitleTeacher') : t('excuses.listTitleStudent')}
                    </h2>
                    {data && <span className="text-sm text-muted-foreground">{t('common.total', { count: data.total })}</span>}
                </div>

                {loading ? (
                    <LoadingState />
                ) : error || !data ? (
                    <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
                ) : data.data.length === 0 ? (
                    <EmptyState icon={FileCheck2} title={t('excuses.emptyTitle')} description={t('excuses.empty')} />
                ) : (
                    <>
                        {/* Mobil va planshet: ixcham kartalar */}
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {data.data.map((item) => (
                                <li key={item.id}>
                                    <Card size="sm" className="h-full gap-3 px-4">
                                        <div className="flex items-start justify-between gap-3">
                                            {personBlock(item)}
                                            {statusBadge(item)}
                                        </div>
                                        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                            {item.school.name}
                                            {item.className ? ` · ${item.className}` : ''}
                                        </p>
                                        <div className="flex flex-wrap items-start gap-3">
                                            <PeriodBadge item={item} />
                                            {reasonBlock(item)}
                                        </div>
                                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                                            {uploadedBlock(item)}
                                            <AttendanceExcuseActions excuseId={item.id} status={item.status} onChanged={() => {
                                                retry();
                                                pending.retry();
                                            }} />
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
                                        <TableHead className="w-[22%]">{isTeacher ? t('excuses.teacher') : t('excuses.student')}</TableHead>
                                        <TableHead className="w-[18%]">{isTeacher ? t('common.school') : `${t('common.school')} / ${t('common.class')}`}</TableHead>
                                        <TableHead className="w-[17%]">{t('excuses.reasonType')}</TableHead>
                                        <TableHead className="w-40">{t('excuses.period')}</TableHead>
                                        <TableHead className="w-[14%]">{t('excuses.uploadedBy')}</TableHead>
                                        <TableHead className="w-28">{t('common.status')}</TableHead>
                                        <TableHead className="w-48 pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.data.map((item, index) => (
                                        <TableRow key={item.id} className="align-top">
                                            <TableCell className="pt-4 pl-5 text-muted-foreground tabular-nums">
                                                {(data.page - 1) * data.limit + index + 1}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">{personBlock(item)}</TableCell>
                                            <TableCell className="whitespace-normal">
                                                <p className="text-sm [overflow-wrap:anywhere]">{item.school.name}</p>
                                                {item.className && <p className="text-xs text-muted-foreground">{item.className}</p>}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">{reasonBlock(item)}</TableCell>
                                            <TableCell className="whitespace-normal">
                                                <PeriodBadge item={item} />
                                            </TableCell>
                                            <TableCell className="whitespace-normal">{uploadedBlock(item)}</TableCell>
                                            <TableCell>{statusBadge(item)}</TableCell>
                                            <TableCell className="pr-5">
                                                <AttendanceExcuseActions excuseId={item.id} status={item.status} onChanged={() => {
                                                retry();
                                                pending.retry();
                                            }} />
                                            </TableCell>
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
