import { useId } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useApiQuery } from '@/hooks/useApiQuery';

import type { School } from '@/types/school';
import type { DailyAttendancePageResponse } from '@/types/daily-attendance';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { authorizedGet } from '@/lib/auth-session';


function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidDate(value: string): boolean {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;

    const parsed = new Date(`${value}T00:00:00Z`);

    return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

function AttendanceFilters({
    date,
    schoolId,
    pnfl,
    onApply,
}: {
    date: string;
    schoolId: string;
    pnfl: string;
    onApply: (values: {
        date: string;
        schoolId: string;
        pnfl: string;
    }) => void;
}) {
    const { t } = useTranslation();
    const id = useId();

    const {
        data: schools,
        loading,
        error,
        retry,
    } = useApiQuery<School[]>('/schools');

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        onApply({
            date: String(form.get('date') ?? ''),
            schoolId: String(form.get('schoolId') ?? ''),
            pnfl: String(form.get('pnfl') ?? '').trim(),
        });
    }

    const selectedExists =
        !schoolId ||
        schools?.some((school) => String(school.id) === schoolId);

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-primary/[0.04] sm:p-5"
        >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                    <label
                        htmlFor={`${id}-date`}
                        className="text-sm font-semibold"
                    >
                        {t('attendance.date')}
                    </label>

                    <Input
                        id={`${id}-date`}
                        name="date"
                        type="date"
                        required
                        min="2000-01-01"
                        max={todayInTashkent()}
                        defaultValue={date}
                    />
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor={`${id}-school`}
                        className="text-sm font-semibold"
                    >
                        {t('attendance.school')}
                    </label>

                    <select
                        id={`${id}-school`}
                        name="schoolId"
                        defaultValue={schoolId}
                        className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <option value="">
                            {t('attendance.allSchools')}
                        </option>

                        {!selectedExists && (
                            <option value={schoolId}>
                                {t('attendance.selectedSchool', { id: schoolId })}
                            </option>
                        )}

                        {schools?.map((school) => (
                            <option key={school.id} value={school.id}>
                                {school.district.name} / {school.name}
                            </option>
                        ))}
                    </select>

                    {loading && (
                        <p className="text-xs text-muted-foreground">
                            {t('attendance.schoolsLoading')}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor={`${id}-pnfl`}
                        className="text-sm font-semibold"
                    >
                        {t('attendance.pnfl')}
                    </label>

                    <Input
                        id={`${id}-pnfl`}
                        name="pnfl"
                        defaultValue={pnfl}
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        maxLength={14}
                        placeholder={t('attendance.pnflPlaceholder')}
                        title={t('attendance.pnflTitle')}
                    />
                </div>
            </div>

            {error && (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={retry}
                    >
                        {t('attendance.retrySchools')}
                    </Button>
                </div>
            )}

            <Button type="submit" className="w-full sm:w-auto">
                {t('attendance.show')}
            </Button>
        </form>
    );
}


function AttendanceResults({
    path,
    onPageChange,
    onLimitChange,
}: {
    path: string;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}) {
    const { t } = useTranslation();

    const { data, loading, error, retry } =
        useApiQuery<DailyAttendancePageResponse>(path);

    if (loading) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                {t('attendance.loading')}
            </p>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-3 rounded-2xl border bg-card p-5">
                <p role="alert" className="text-sm text-destructive">
                    {error || t('attendance.loadFailed')}
                </p>

                <Button variant="outline" onClick={retry}>
                    {t('attendance.retry')}
                </Button>
            </div>
        );
    }

    const totalPages = Math.max(1, data.totalPages);
    const currentPage = data.page;

    const firstRow = data.data.length
        ? (currentPage - 1) * data.limit + 1
        : 0;

    const lastRow = data.data.length
        ? firstRow + data.data.length - 1
        : 0;

    const canPrevious = currentPage > 1;
    const canNext = currentPage < totalPages;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold">
                        O‘quvchilar davomati
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Jami {data.total} ta yozuv
                    </p>
                </div>

                <Button type="button" variant="outline" onClick={retry}>
                    {t('attendance.refresh')}
                </Button>
            </div>

            {data.data.length > 0 ? (
                <AttendanceTable
                    items={data.data}
                    startIndex={firstRow}
                />
            ) : (
                <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        {t('attendance.empty')}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        {firstRow}–{lastRow} / {data.total}
                    </p>

                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="attendance-page-limit"
                            className="text-sm text-muted-foreground"
                        >
                            Sahifada:
                        </label>

                        <select
                            id="attendance-page-limit"
                            value={String(data.limit)}
                            onChange={(event) =>
                                onLimitChange(Number(event.target.value))
                            }
                            className="h-9 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canPrevious}
                        aria-label="Birinchi sahifa"
                        title="Birinchi sahifa"
                        onClick={() => onPageChange(1)}
                    >
                        <ChevronsLeft className="size-4" />
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canPrevious}
                        aria-label="Oldingi sahifa"
                        title="Oldingi sahifa"
                        onClick={() =>
                            onPageChange(currentPage - 1)
                        }
                    >
                        <ChevronLeft className="size-4" />
                    </Button>

                    <span className="min-w-20 text-center text-sm font-medium tabular-nums">
                        {currentPage} / {totalPages}
                    </span>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canNext}
                        aria-label="Keyingi sahifa"
                        title="Keyingi sahifa"
                        onClick={() =>
                            onPageChange(currentPage + 1)
                        }
                    >
                        <ChevronRight className="size-4" />
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canNext}
                        aria-label="Oxirgi sahifa"
                        title="Oxirgi sahifa"
                        onClick={() => onPageChange(totalPages)}
                    >
                        <ChevronsRight className="size-4" />
                    </Button>
                </div>
            </div>
        </section>
    );
}


export function AttendancePage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const date = searchParams.get('date') ?? todayInTashkent();
    const schoolId = searchParams.get('schoolId') ?? '';
    const pnfl = searchParams.get('pnfl') ?? '';
    const pageText = searchParams.get('page') ?? '1';
    const limitText = searchParams.get('limit') ?? '20';

    const validLimit = ['20', '50', '100'].includes(limitText);

    const validSchool =
        !schoolId ||
        (
            /^[1-9]\d*$/.test(schoolId) &&
            Number.isSafeInteger(Number(schoolId)) &&
            Number(schoolId) <= 4294967295
        );

    const validPage =
        /^[1-9]\d*$/.test(pageText) &&
        Number(pageText) <= 100000;

    if (
        !isValidDate(date) ||
        !validSchool ||
        !validPage ||
        !validLimit ||
        (pnfl !== '' && !/^\d{14}$/.test(pnfl))
    ) {
        return (
            <div className="space-y-3">
                <p role="alert" className="text-sm text-destructive">
                    {t('attendance.invalidUrl')}
                </p>

                <Button onClick={() => setSearchParams({})}>
                    {t('attendance.clearFilters')}
                </Button>
            </div>
        );
    }

    const query = new URLSearchParams({
        date,
        page: pageText,
        limit: limitText,
    });

    if (schoolId) query.set('schoolId', schoolId);
    if (pnfl) query.set('pnfl', pnfl);

    const path = `/daily-attendance?${query.toString()}`;

    async function exportExcel() {
        if (exporting) return;

        setExporting(true);
        setExportError('');

        try {
            // Jadvalga qo‘llangan faol filtrlar.
            const exportQuery = new URLSearchParams(query);

            // Pagination eksportga ta’sir qilmaydi.
            exportQuery.delete('page');
            exportQuery.delete('limit');

            const blob = await authorizedGet<Blob>(
                `/daily-attendance/export?${exportQuery}`,
                undefined,
                'blob',
                120_000,
            );

            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `davomat-${date}.xlsx`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 30_000);
        } catch (error: unknown) {
            setExportError(
                error instanceof Error
                    ? error.message
                    : 'Excel eksportda xatolik yuz berdi.',
            );
        } finally {
            setExporting(false);
        }
    }

    function changePage(page: number) {
        const next = new URLSearchParams(searchParams);

        next.set('date', date);
        next.set('page', String(page));

        setSearchParams(next);
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
            <PageHeader
                eyebrow={t('nav.groupManage')}
                title={t('attendance.title')}
                description={t('attendance.subtitle')}
                actions={
                    <Button
                        type="button"
                        disabled={exporting}
                        onClick={() => void exportExcel()}
                    >
                        <Download className="size-4" />
                        {exporting
                            ? 'Excel tayyorlanmoqda...'
                            : 'Excel yuklab olish'}
                    </Button>
                }
            />

            {exportError && (
                <p role="alert" className="text-sm text-destructive">
                    {exportError}
                </p>
            )}

            <AttendanceFilters
                key={`${date}|${schoolId}|${pnfl}`}
                date={date}
                schoolId={schoolId}
                pnfl={pnfl}
                onApply={(values) => {
                    const next = new URLSearchParams({
                        date: values.date,
                        page: '1',
                    });

                    if (values.schoolId) {
                        next.set('schoolId', values.schoolId);
                    }

                    if (values.pnfl) {
                        next.set('pnfl', values.pnfl);
                    }

                    setSearchParams(next);
                }}
            />

            <AttendanceResults
                key={path}
                path={path}
                onPageChange={changePage}
                onLimitChange={changeLimit}
            />
        </div>
    );
}