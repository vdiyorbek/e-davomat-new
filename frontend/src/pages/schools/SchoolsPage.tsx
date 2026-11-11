import { useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { SchoolForm } from '@/components/schools/SchoolForm';
import { SchoolMembersLinks } from '@/components/schools/SchoolMembersLinks';
import { SchoolsFilters } from '@/components/schools/SchoolsFilters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/lib/date';
import type { CreatedSchool, School, SchoolRow, SchoolsPage as SchoolsPageData } from '@/types/school';

const ID_PATTERN = /^[1-9][0-9]*$/;
const MAX_ID = 4294967295;

function validId(value: string | null) {
    return value === null || (ID_PATTERN.test(value) && Number(value) <= MAX_ID);
}

function TerminalsCount({ school }: { school: SchoolRow }) {
    const { t } = useTranslation();
    const inactive = school.stats.terminals - school.stats.activeTerminals;

    return (
        <div>
            <span className="font-semibold tabular-nums">{formatNumber(school.stats.activeTerminals)}</span>
            {inactive > 0 && (
                <p className="text-xs text-muted-foreground">{t('schools.inactiveTerminals', { count: inactive })}</p>
            )}
        </div>
    );
}

interface ResultsProps {
    path: string;
    hasFilters: boolean;
    onPageChange: (page: number) => void;
    onClearFilters: () => void;
    onEdit?: (school: School) => void;
}

function SchoolsResults({ path, hasFilters, onPageChange, onClearFilters, onEdit }: ResultsProps) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<SchoolsPageData>(path);

    if (loading) return <LoadingState label={t('schools.loading')} />;
    if (error) return <ErrorState title={t('schools.loadFailed')} message={error} onRetry={retry} />;
    if (!data) return null;

    if (data.data.length === 0) {
        return hasFilters ? (
            <EmptyState
                icon={Search}
                title={t('schools.noMatchTitle')}
                description={t('schools.noMatch')}
                action={
                    <Button variant="outline" onClick={onClearFilters}>
                        {t('common.clearFilters')}
                    </Button>
                }
            />
        ) : (
            <EmptyState
                icon={Building2}
                title={t('schools.emptyTitle')}
                description={t('schools.empty')}
                action={
                    data.page > 1 ? (
                        <Button variant="outline" onClick={() => onPageChange(1)}>
                            {t('common.pagination.firstPage')}
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    const firstRow = (data.page - 1) * data.limit + 1;

    function editButton(school: School, full = false) {
        if (!onEdit) return null;
        return (
            <Button
                type="button"
                variant="ghost"
                size={full ? 'sm' : 'icon-sm'}
                className={full ? undefined : 'size-8'}
                onClick={() => onEdit(school)}
                aria-label={`${school.name} — ${t('common.edit')}`}
            >
                <Pencil aria-hidden="true" />
                {full && t('common.edit')}
            </Button>
        );
    }

    return (
        <div className="min-w-0 space-y-4">
            {/* Telefon va planshet: kartalar */}
            <ul aria-label={t('schools.listLabel')} className="grid min-w-0 list-none gap-3 sm:grid-cols-2 xl:hidden">
                {data.data.map((school) => (
                    <li key={school.id}>
                        <Card size="sm" className="h-full gap-3 px-4">
                            <div className="flex items-start gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                    <Building2 aria-hidden="true" className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm leading-5 font-semibold [overflow-wrap:anywhere]">{school.name}</h2>
                                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                                        <MapPin aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                                        <span>
                                            {school.district.region.name} / {school.district.name}
                                        </span>
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">#{school.id}</span>
                            </div>

                            <dl className="grid grid-cols-3 gap-2 text-center">
                                {(
                                    [
                                        ['students', school.stats.students],
                                        ['teachers', school.stats.teachers],
                                        ['terminals', school.stats.activeTerminals],
                                    ] as const
                                ).map(([key, value]) => (
                                    <div key={key} className="rounded-lg bg-muted/40 px-2 py-1.5">
                                        <dt className="truncate text-[11px] text-muted-foreground">{t(`schools.columns.${key}`)}</dt>
                                        <dd className="font-semibold tabular-nums">{formatNumber(value)}</dd>
                                    </div>
                                ))}
                            </dl>

                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                <SchoolMembersLinks schoolId={school.id} schoolName={school.name} />
                                {editButton(school, true)}
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>

            {/* Kompyuter: jadval */}
            <Card className="hidden py-0 xl:flex">
                <Table className="min-w-[960px]">
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                            <TableHead>{t('schools.name')}</TableHead>
                            <TableHead>{t('schools.columns.location')}</TableHead>
                            <TableHead className="w-28 text-right">{t('schools.columns.students')}</TableHead>
                            <TableHead className="w-28 text-right">{t('schools.columns.teachers')}</TableHead>
                            <TableHead className="w-28 text-right">{t('schools.columns.terminals')}</TableHead>
                            <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.data.map((school, index) => (
                            <TableRow key={school.id}>
                                <TableCell className="pl-5 text-muted-foreground tabular-nums">{firstRow + index}</TableCell>
                                <TableCell className="max-w-80 whitespace-normal">
                                    <span className="font-semibold">{school.name}</span>
                                    <p className="text-xs text-muted-foreground tabular-nums">ID: {school.id}</p>
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    {school.district.name}
                                    <p className="text-xs text-muted-foreground">{school.district.region.name}</p>
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                    {formatNumber(school.stats.students)}
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                    {formatNumber(school.stats.teachers)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <TerminalsCount school={school} />
                                </TableCell>
                                <TableCell className="pr-5">
                                    <div className="flex items-center justify-end gap-2">
                                        <SchoolMembersLinks schoolId={school.id} schoolName={school.name} className="flex-nowrap" />
                                        {editButton(school)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={onPageChange}
                total={data.total}
                pageSize={data.limit}
                shownCount={data.data.length}
                label={t('schools.pagesLabel')}
            />
        </div>
    );
}

export function SchoolsPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [formOpen, setFormOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [refreshVersion, setRefreshVersion] = useState(0);

    const canCreate = session?.profile.role === 'SUPER_ADMIN';

    const pageValue = searchParams.get('page') ?? '1';
    const regionValue = searchParams.get('regionId');
    const districtValue = searchParams.get('districtId');
    const searchValue = searchParams.get('q') ?? '';
    const page = Number(pageValue);

    const valid =
        /^\d+$/.test(pageValue) &&
        page >= 1 &&
        page <= 100000 &&
        validId(regionValue) &&
        validId(districtValue) &&
        searchValue.length <= 100;

    const header = (
        <PageHeader
            eyebrow={t('nav.groups.education')}
            title={t('schools.title')}
            description={t('schools.subtitle')}
            actions={
                canCreate ? (
                    <Button type="button" className="w-full sm:w-auto" onClick={() => openForm(null)}>
                        <Plus aria-hidden="true" />
                        {t('schools.add')}
                    </Button>
                ) : undefined
            }
        />
    );

    function openForm(school: School | null) {
        setSuccessMessage('');
        setEditingSchool(school);
        setFormOpen(true);
    }

    function handleSaved(school: CreatedSchool) {
        const wasEditing = editingSchool !== null;
        setFormOpen(false);
        setEditingSchool(null);
        setSuccessMessage(wasEditing ? t('schools.updated', { name: school.name }) : t('schools.created', { name: school.name }));
        setRefreshVersion((value) => value + 1);
    }

    function changePage(nextPage: number) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(nextPage));
        setSearchParams(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearFilters() {
        setSearchParams({});
    }

    if (!valid) {
        return (
            <div className="space-y-6">
                {header}
                <ErrorState message={t('common.invalidUrl')} />
                <Button variant="outline" onClick={clearFilters}>
                    {t('common.resetUrl')}
                </Button>
            </div>
        );
    }

    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (regionValue) query.set('regionId', regionValue);
    if (districtValue) query.set('districtId', districtValue);
    if (searchValue.trim()) query.set('q', searchValue.trim());
    const path = `/schools/page?${query.toString()}`;

    const hasFilters = Boolean(regionValue || districtValue || searchValue.trim());

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            {header}

            {successMessage && <SuccessNotice>{successMessage}</SuccessNotice>}

            <SchoolsFilters />

            <SchoolsResults
                key={`${path}-${refreshVersion}`}
                path={path}
                hasFilters={hasFilters}
                onPageChange={changePage}
                onClearFilters={clearFilters}
                {...(canCreate ? { onEdit: (school: School) => openForm(school) } : {})}
            />

            {canCreate && (
                <Dialog
                    open={formOpen}
                    onOpenChange={(open) => {
                        setFormOpen(open);
                        if (!open) setEditingSchool(null);
                    }}
                >
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingSchool ? t('schools.editTitle') : t('schools.createTitle')}</DialogTitle>
                            <DialogDescription>{editingSchool ? t('schools.editHint') : t('schools.createHint')}</DialogDescription>
                        </DialogHeader>
                        <SchoolForm
                            key={editingSchool?.id ?? 'create'}
                            {...(editingSchool ? { school: editingSchool } : {})}
                            onSaved={handleSaved}
                            onCancel={() => {
                                setFormOpen(false);
                                setEditingSchool(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}