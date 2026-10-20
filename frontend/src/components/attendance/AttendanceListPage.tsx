import { useState } from 'react';
import { ChevronsLeft, ChevronsRight, ClipboardList, Download, Loader2, RotateCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AttendanceFilters } from '@/components/attendance/AttendanceFilters';
import type { AttendanceFilterValues } from '@/components/attendance/AttendanceFilters';
import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedGet } from '@/lib/auth-session';
import { formatDateLong, formatNumber, todayInTashkent } from '@/lib/date';
import type { DailyAttendancePageResponse } from '@/types/daily-attendance';

type Mode = 'students' | 'teachers';

const LIMITS = ['20', '50', '100'];

function isValidDate(value: string): boolean {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validId(value: string): boolean {
    return value === '' || (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 4294967295);
}

function AttendanceResults({
    path,
    mode,
    date,
    onPageChange,
    onLimitChange,
}: {
    path: string;
    mode: Mode;
    date: string;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<DailyAttendancePageResponse>(path);

    if (loading) return <LoadingState label={t('attendance.loading')} rows={6} />;
    if (error || !data) return <ErrorState message={error || t('attendance.loadFailed')} onRetry={retry} />;

    const totalPages = Math.max(1, data.totalPages);
    const firstRow = data.data.length ? (data.page - 1) * data.limit + 1 : 0;

    return (
        <section className="space-y-4" aria-labelledby="attendance-results-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="attendance-results-title" className="font-heading text-lg font-bold">
                        {formatDateLong(date)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t('attendance.total', { count: data.total, formatted: formatNumber(data.total) })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground max-sm:sr-only">{t('attendance.perPage')}</span>
                    <SelectField
                        value={String(data.limit)}
                        onValueChange={(value) => onLimitChange(Number(value))}
                        options={LIMITS.map((value) => ({ value, label: value }))}
                        aria-label={t('attendance.perPage')}
                        className="h-10 w-20"
                    />
                    <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={retry}>
                        <RotateCw aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {data.data.length > 0 ? (
                <AttendanceTable items={data.data} startIndex={firstRow} onExcuseSaved={retry} mode={mode} />
            ) : (
                <EmptyState icon={ClipboardList} title={t('attendance.emptyTitle')} description={t('attendance.empty')} />
            )}

            {data.total > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Pagination
                        className="flex-1"
                        page={data.page}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.data.length}
                    />
                    {totalPages > 2 && (
                        <div className="flex justify-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={data.page <= 1}
                                aria-label={t('attendance.firstPage')}
                                onClick={() => onPageChange(1)}
                            >
                                <ChevronsLeft aria-hidden="true" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={data.page >= totalPages}
                                aria-label={t('attendance.lastPage')}
                                onClick={() => onPageChange(totalPages)}
                            >
                                <ChevronsRight aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

/** O‘quvchilar va o‘qituvchilar davomati sahifalari uchun umumiy komponent. */
export function AttendanceListPage({ mode }: { mode: Mode }) {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const students = mode === 'students';
    const date = searchParams.get('date') ?? todayInTashkent();
    const regionId = searchParams.get('regionId') ?? '';
    const districtId = searchParams.get('districtId') ?? '';
    const schoolId = searchParams.get('schoolId') ?? '';
    const classId = students ? searchParams.get('classId') ?? '' : '';
    const attendanceStatus = searchParams.get('attendanceStatus') ?? '';
    const search = searchParams.get('search')?.trim() ?? '';
    const pnfl = searchParams.get('pnfl') ?? '';
    const pageText = searchParams.get('page') ?? '1';
    const limitText = searchParams.get('limit') ?? '20';

    const allowedStatuses = students ? ['inside', 'left', 'excused', 'absent'] : ['inside', 'left', 'absent'];

    const valid =
        isValidDate(date) &&
        [regionId, districtId, schoolId, classId].every(validId) &&
        /^[1-9]\d*$/.test(pageText) &&
        Number(pageText) <= 100000 &&
        LIMITS.includes(limitText) &&
        (attendanceStatus === '' || allowedStatuses.includes(attendanceStatus)) &&
        (search === '' || (search.length >= 2 && search.length <= 100)) &&
        (pnfl === '' || /^\d{14}$/.test(pnfl));

    const filters: AttendanceFilterValues = { date, regionId, districtId, schoolId, classId, attendanceStatus, search, pnfl };

    const query = new URLSearchParams({ date, page: pageText, limit: limitText });
    for (const [name, value] of Object.entries(filters)) {
        if (name !== 'date' && value !== '') query.set(name, value);
    }
    const path = `/daily-attendance/${mode}?${query.toString()}`;

    async function exportExcel() {
        if (exporting) return;
        setExporting(true);
        setExportError('');
        try {
            // Jadvalga qo‘llangan faol filtrlar; sahifalash eksportga ta’sir qilmaydi.
            const exportQuery = new URLSearchParams(query);
            exportQuery.delete('page');
            exportQuery.delete('limit');

            const blob = await authorizedGet<Blob>(`/daily-attendance/${mode}/export?${exportQuery}`, undefined, 'blob', 120_000);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${students ? 'oquvchilar' : 'oqituvchilar'}-davomat-${date}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (error: unknown) {
            setExportError(error instanceof Error ? error.message : t('attendance.exportFailed'));
        } finally {
            setExporting(false);
        }
    }

    const header = (
        <PageHeader
            eyebrow={t('nav.groups.attendance')}
            title={t(`attendance.${mode}.title`)}
            description={t(`attendance.${mode}.subtitle`)}
            actions={
                valid ? (
                    <Button type="button" variant="outline" className="bg-card" disabled={exporting} onClick={() => void exportExcel()}>
                        {exporting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
                        {exporting ? t('attendance.exporting') : t('attendance.export')}
                    </Button>
                ) : undefined
            }
        />
    );

    if (!valid) {
        return (
            <div className="space-y-6">
                {header}
                <ErrorState message={t('attendance.invalidUrl')} />
                <Button onClick={() => setSearchParams({})}>{t('common.clearFilters')}</Button>
            </div>
        );
    }

    function changePage(page: number) {
        const next = new URLSearchParams(searchParams);
        next.set('date', date);
        next.set('page', String(page));
        setSearchParams(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function changeLimit(limit: number) {
        if (![20, 50, 100].includes(limit)) return;
        const next = new URLSearchParams(searchParams);
        next.set('date', date);
        next.set('limit', String(limit));
        next.set('page', '1');
        setSearchParams(next);
    }

    return (
        <div className="space-y-6">
            {header}
            {exportError && <ErrorState message={exportError} />}

            <AttendanceFilters
                key={[date, regionId, districtId, schoolId, classId, attendanceStatus, search, pnfl].join('|')}
                values={filters}
                mode={mode}
                onApply={(values) => {
                    const next = new URLSearchParams({ date: values.date, page: '1', limit: limitText });
                    for (const [name, value] of Object.entries(values)) {
                        if (name !== 'date' && value !== '') next.set(name, value);
                    }
                    setSearchParams(next);
                }}
            />

            <AttendanceResults key={path} path={path} mode={mode} date={date} onPageChange={changePage} onLimitChange={changeLimit} />
        </div>
    );
}
