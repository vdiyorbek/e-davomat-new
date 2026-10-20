import { useId, useState } from 'react';
import { FileCheck2, RotateCw } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AttendanceExcuseActions } from '@/components/attendance/AttendanceExcuseActions';
import { CreateAttendanceExcuseDialog } from '@/components/attendance/CreateAttendanceExcuseDialog';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { AttendanceExcuse, AttendanceExcusesPageResponse, ExcuseStatus } from '@/types/attendance-excuse';
import type { School } from '@/types/school';

interface AppliedFilters {
    schoolId: string;
    personId: string;
    status: string;
}

const DEFAULT_FILTERS: AppliedFilters = { schoolId: '', personId: '', status: 'ACTIVE' };

export function AttendanceExcusesPage() {
    const { t } = useTranslation();
    const id = useId();
    const [draft, setDraft] = useState<AppliedFilters>(DEFAULT_FILTERS);
    const [filters, setFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);
    const [filterError, setFilterError] = useState('');

    const { data: schools } = useApiQuery<School[]>('/schools');

    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (filters.schoolId) query.set('schoolId', filters.schoolId);
    if (filters.personId) query.set('personId', filters.personId);
    if (filters.status) query.set('status', filters.status);

    const { data, loading, error, retry } = useApiQuery<AttendanceExcusesPageResponse>(`/attendance-excuses?${query.toString()}`);

    function applyFilters() {
        if (draft.personId && (!/^[1-9]\d*$/.test(draft.personId) || Number(draft.personId) > 4294967295)) {
            setFilterError(t('excuses.filters.invalidPersonId'));
            return;
        }
        setFilterError('');
        setPage(1);
        setFilters({ ...draft });
    }

    function statusBadge(item: AttendanceExcuse) {
        return (
            <StatusBadge tone={item.status === 'ACTIVE' ? 'primary' : 'neutral'}>
                {t(`excuses.status.${item.status}`)}
            </StatusBadge>
        );
    }

    function nameLink(item: AttendanceExcuse) {
        return (
            <Link to={`/persons/${item.personId}`} className="font-semibold underline-offset-4 hover:text-primary hover:underline">
                {personFullName(item.person, t('common.personMissing'))}
            </Link>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.attendance')}
                title={t('excuses.title')}
                description={t('excuses.subtitle')}
                actions={
                    <>
                        <CreateAttendanceExcuseDialog
                            onSaved={() => {
                                setPage(1);
                                setDraft((previous) => ({ ...previous, status: 'ACTIVE' }));
                                setFilters((previous) => ({ ...previous, status: 'ACTIVE' }));
                                retry();
                            }}
                        />
                        <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={retry}>
                            <RotateCw aria-hidden="true" />
                        </Button>
                    </>
                }
            />

            <form
                className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    applyFilters();
                }}
            >
                <div className="grid gap-4 md:grid-cols-3">
                    <Field htmlFor={`${id}-school`} label={t('common.school')}>
                        <SelectField
                            id={`${id}-school`}
                            value={draft.schoolId}
                            onValueChange={(value) => setDraft((previous) => ({ ...previous, schoolId: value }))}
                            emptyOption={t('filters.allSchools')}
                            options={(schools ?? []).map((school) => ({ value: String(school.id), label: school.name }))}
                        />
                    </Field>
                    <Field htmlFor={`${id}-person`} label={`${t('excuses.filters.personId')} (${t('common.optional')})`} error={filterError || undefined}>
                        <Input
                            id={`${id}-person`}
                            inputMode="numeric"
                            value={draft.personId}
                            placeholder={t('excuses.filters.personIdPlaceholder')}
                            onChange={(event) => setDraft((previous) => ({ ...previous, personId: event.target.value.replace(/\D/g, '') }))}
                        />
                    </Field>
                    <Field htmlFor={`${id}-status`} label={t('excuses.filters.status')}>
                        <SelectField
                            id={`${id}-status`}
                            value={draft.status}
                            onValueChange={(value) => setDraft((previous) => ({ ...previous, status: value }))}
                            emptyOption={t('excuses.filters.all')}
                            options={(['ACTIVE', 'CANCELLED'] as const).map((value) => ({ value, label: t(`excuses.status.${value}`) }))}
                        />
                    </Field>
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setDraft(DEFAULT_FILTERS);
                            setFilters(DEFAULT_FILTERS);
                            setPage(1);
                            setFilterError('');
                        }}
                    >
                        {t('common.clearFilters')}
                    </Button>
                    <Button type="submit">{t('common.show')}</Button>
                </div>
            </form>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-bold">{t('excuses.listTitle')}</h2>
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
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {data.data.map((item) => (
                                <li key={item.id}>
                                    <Card size="sm" className="gap-3 px-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="leading-6 [overflow-wrap:anywhere]">{nameLink(item)}</p>
                                                <p className="text-xs text-muted-foreground">{t('excuses.number', { id: item.id })}</p>
                                            </div>
                                            {statusBadge(item)}
                                        </div>
                                        <DetailList>
                                            <DetailItem label={t('excuses.reasonType')}>{t(`excuses.reason.${item.reason}`)}</DetailItem>
                                            <DetailItem label={t('excuses.period')}>
                                                <span className="tabular-nums">
                                                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                                                </span>
                                            </DetailItem>
                                            <DetailItem label={t('common.school')} wide>
                                                {item.school.name}
                                            </DetailItem>
                                        </DetailList>
                                        <div className="border-t pt-3">
                                            <AttendanceExcuseActions excuseId={item.id} status={item.status as ExcuseStatus} onChanged={retry} />
                                        </div>
                                    </Card>
                                </li>
                            ))}
                        </ul>

                        <Card className="hidden py-0 xl:flex">
                            <Table className="min-w-[880px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                                        <TableHead>{t('excuses.student')}</TableHead>
                                        <TableHead>{t('common.school')}</TableHead>
                                        <TableHead>{t('excuses.reasonType')}</TableHead>
                                        <TableHead>{t('excuses.period')}</TableHead>
                                        <TableHead>{t('common.status')}</TableHead>
                                        <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.data.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="pl-5 text-muted-foreground tabular-nums">
                                                {(data.page - 1) * data.limit + index + 1}
                                            </TableCell>
                                            <TableCell className="max-w-60 whitespace-normal">
                                                {nameLink(item)}
                                                <p className="mt-0.5 text-xs text-muted-foreground">{t('excuses.number', { id: item.id })}</p>
                                            </TableCell>
                                            <TableCell className="max-w-60 whitespace-normal">{item.school.name}</TableCell>
                                            <TableCell>{t(`excuses.reason.${item.reason}`)}</TableCell>
                                            <TableCell className="tabular-nums">
                                                {formatDate(item.startDate)} — {formatDate(item.endDate)}
                                            </TableCell>
                                            <TableCell>{statusBadge(item)}</TableCell>
                                            <TableCell className="pr-5">
                                                <AttendanceExcuseActions excuseId={item.id} status={item.status as ExcuseStatus} onChanged={retry} />
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
                        onPageChange={setPage}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.data.length}
                    />
                )}
            </section>
        </div>
    );
}
