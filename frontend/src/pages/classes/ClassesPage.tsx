import { useState } from 'react';
import { Plus, School as SchoolIcon, Search, TriangleAlert, Users } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { parsePageSize } from '@/lib/pagination';
import { ClassesFilters } from '@/components/classes/ClassesFilters';
import { CreateClassForm } from '@/components/classes/CreateClassForm';
import { GradeLevelEditor } from '@/components/classes/GradeLevelEditor';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { academicYearFor, formatNumber, isValidAcademicYear, todayInTashkent } from '@/lib/date';
import { GRADES } from '@/lib/grades';
import type { SchoolClassRow, SchoolClassesPage } from '@/types/school-class';

const ID_PATTERN = /^[1-9][0-9]*$/;
const MAX_ID = 4294967295;

function validId(value: string | null) {
    return value === null || (ID_PATTERN.test(value) && Number(value) <= MAX_ID);
}

function GradeCell({ item, canEdit, onSaved }: { item: SchoolClassRow; canEdit: boolean; onSaved: () => void }) {
    const { t } = useTranslation();

    if (canEdit) {
        return (
            <div className="space-y-1">
                <GradeLevelEditor key={`${item.id}-${item.gradeLevel ?? 'none'}`} schoolClass={item} onSaved={onSaved} />
                {item.gradeLevel == null && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TriangleAlert aria-hidden="true" className="size-3.5 text-warning" />
                        {t('classes.gradeMissing')}
                    </p>
                )}
            </div>
        );
    }

    return item.gradeLevel == null ? (
        <StatusBadge tone="warning">{t('classes.gradeMissing')}</StatusBadge>
    ) : (
        <span>{t('calendar.gradeN', { grade: item.gradeLevel })}</span>
    );
}

interface ResultsProps {
    path: string;
    canEdit: boolean;
    hasFilters: boolean;
    gradeFilter: string;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    onShowMissing: () => void;
    onClearFilters: () => void;
}

function ClassesResults({ path, canEdit, hasFilters, gradeFilter, onPageChange, onLimitChange, onShowMissing, onClearFilters }: ResultsProps) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<SchoolClassesPage>(path);

    if (loading) return <LoadingState rows={6} />;
    if (error) return <ErrorState message={error} onRetry={retry} />;
    if (!data) return null;

    const summary = (
        <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral" dot={false}>
                {t('common.total', { count: data.total })}
            </StatusBadge>
            {data.missingGrade > 0 && gradeFilter !== 'NONE' && (
                <Button type="button" variant="outline" size="sm" onClick={onShowMissing} className="h-7 gap-1.5 text-xs">
                    <TriangleAlert aria-hidden="true" className="size-3.5 text-warning" />
                    {t('classes.missingGrade', { count: data.missingGrade })}
                </Button>
            )}
        </div>
    );

    if (data.data.length === 0) {
        return (
            <div className="space-y-4">
                {summary}
                {hasFilters ? (
                    <EmptyState
                        icon={Search}
                        title={t('classes.noMatchTitle')}
                        description={t('classes.noMatch')}
                        action={
                            <Button variant="outline" onClick={onClearFilters}>
                                {t('common.clearFilters')}
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={SchoolIcon}
                        title={t('classes.emptyTitle')}
                        description={t('classes.empty')}
                        action={
                            data.page > 1 ? (
                                <Button variant="outline" onClick={() => onPageChange(1)}>
                                    {t('common.pagination.firstPage')}
                                </Button>
                            ) : undefined
                        }
                    />
                )}
            </div>
        );
    }

    const firstRow = (data.page - 1) * data.limit + 1;

    return (
        <div className="min-w-0 space-y-4">
            {summary}

            {/* Telefon va planshet: kartalar */}
            <ul className="grid min-w-0 list-none gap-3 sm:grid-cols-2 xl:hidden">
                {data.data.map((item) => (
                    <li key={item.id}>
                        <Card size="sm" className="h-full gap-3 px-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-heading text-xl font-bold">{item.name}</p>
                                    <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                        {item.school.name} · {item.school.district.name}
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.academicYear}</span>
                            </div>
                            <GradeCell item={item} canEdit={canEdit} onSaved={retry} />
                            <p className="mt-auto flex items-center gap-1.5 border-t pt-3 text-sm text-muted-foreground">
                                <Users aria-hidden="true" className="size-4" />
                                {t('classes.studentsCount', { count: item.stats.students })}
                            </p>
                        </Card>
                    </li>
                ))}
            </ul>

            {/* Kompyuter: jadval */}
            <Card className="hidden py-0 xl:flex">
                <Table className="min-w-[900px]">
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                            <TableHead className="w-32">{t('classes.columns.class')}</TableHead>
                            <TableHead>{t('common.school')}</TableHead>
                            <TableHead className="w-64">{t('classes.grade')}</TableHead>
                            <TableHead className="w-32 pr-5 text-right">{t('classes.columns.students')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.data.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell className="pl-5 text-muted-foreground tabular-nums">{firstRow + index}</TableCell>
                                <TableCell>
                                    <span className="font-heading text-base font-bold">{item.name}</span>
                                    <p className="text-xs text-muted-foreground tabular-nums">{item.academicYear}</p>
                                </TableCell>
                                <TableCell className="max-w-96 whitespace-normal">
                                    <span className="font-medium">{item.school.name}</span>
                                    <p className="text-xs text-muted-foreground">
                                        {item.school.district.name} · {item.school.district.region.name}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <GradeCell item={item} canEdit={canEdit} onSaved={retry} />
                                </TableCell>
                                <TableCell className="pr-5 text-right font-semibold tabular-nums">
                                    {formatNumber(item.stats.students)}
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
                onPageSizeChange={onLimitChange}
                total={data.total}
                pageSize={data.limit}
                shownCount={data.data.length}
                label={t('classes.pagesLabel')}
            />
        </div>
    );
}

export function ClassesPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [showCreate, setShowCreate] = useState(false);
    const [success, setSuccess] = useState('');
    const [refreshVersion, setRefreshVersion] = useState(0);

    const role = session?.profile.role;
    const canCreate = role === 'SUPER_ADMIN' || role === 'REGION_ADMIN' || role === 'DISTRICT_ADMIN' || role === 'SCHOOL_ADMIN';

    const pageValue = searchParams.get('page') ?? '1';
    const academicYear = searchParams.get('academicYear') ?? academicYearFor(todayInTashkent());
    const gradeValue = searchParams.get('grade') ?? '';
    const regionValue = searchParams.get('regionId');
    const districtValue = searchParams.get('districtId');
    const schoolValue = searchParams.get('schoolId');
    const searchValue = searchParams.get('q') ?? '';
    const page = Number(pageValue);
    const limit = parsePageSize(searchParams.get('limit'));
    const valid =
        /^\d+$/.test(pageValue) &&
        page >= 1 &&
        page <= 100000 &&
        isValidAcademicYear(academicYear) &&
        (gradeValue === '' || gradeValue === 'NONE' || GRADES.includes(gradeValue)) &&
        validId(regionValue) &&
        validId(districtValue) &&
        validId(schoolValue) &&
        searchValue.length <= 100 &&
        limit !== null;

    const header = (
        <PageHeader
            eyebrow={t('nav.groups.education')}
            title={t('classes.title')}
            description={t('classes.subtitle')}
            actions={
                canCreate ? (
                    <Button
                        type="button"
                        className="w-full sm:w-auto"
                        onClick={() => {
                            setSuccess('');
                            setShowCreate(true);
                        }}
                    >
                        <Plus aria-hidden="true" />
                        {t('classes.add')}
                    </Button>
                ) : undefined
            }
        />
    );

    function updateParams(change: (next: URLSearchParams) => void) {
        const next = new URLSearchParams(searchParams);
        change(next);
        setSearchParams(next);
    }

    function changePage(nextPage: number) {
        updateParams((next) => next.set('page', String(nextPage)));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function changeLimit(nextLimit: number) {
        updateParams((next) => {
            next.set('limit', String(nextLimit));
            next.set('page', '1');
        });
    }

    function clearFilters() {
        const next = new URLSearchParams();
        if (searchParams.get('academicYear')) next.set('academicYear', academicYear);
        if (searchParams.get('limit')) next.set('limit', String(limit));
        setSearchParams(next);
    }

    if (!valid) {
        return (
            <div className="space-y-6">
                {header}
                <ErrorState message={t('common.invalidUrl')} />
                <Button variant="outline" onClick={() => setSearchParams({})}>
                    {t('common.resetUrl')}
                </Button>
            </div>
        );
    }

    const query = new URLSearchParams({ page: String(page), limit: String(limit), academicYear });
    if (gradeValue) query.set('grade', gradeValue);
    if (regionValue) query.set('regionId', regionValue);
    if (districtValue) query.set('districtId', districtValue);
    if (schoolValue) query.set('schoolId', schoolValue);
    if (searchValue.trim()) query.set('q', searchValue.trim());
    const path = `/classes/page?${query.toString()}`;

    const hasFilters = Boolean(gradeValue || regionValue || districtValue || schoolValue || searchValue.trim());

    return (
        <div className="w-full min-w-0 space-y-5 sm:space-y-6">
            {header}

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <ClassesFilters academicYear={academicYear} />

            <ClassesResults
                key={`${path}-${refreshVersion}`}
                path={path}
                canEdit={canCreate}
                hasFilters={hasFilters}
                gradeFilter={gradeValue}
                onPageChange={changePage}
                onLimitChange={changeLimit}
                onShowMissing={() =>
                    updateParams((next) => {
                        next.set('grade', 'NONE');
                        next.set('page', '1');
                    })
                }
                onClearFilters={clearFilters}
            />

            {canCreate && (
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{t('classes.createTitle')}</DialogTitle>
                            <DialogDescription>{t('classes.createDescription')}</DialogDescription>
                        </DialogHeader>
                        {showCreate && (
                            <CreateClassForm
                                {...(schoolValue ? { initialSchoolId: schoolValue } : {})}
                                initialAcademicYear={academicYear}
                                onCancel={() => setShowCreate(false)}
                                onSaved={(created) => {
                                    setShowCreate(false);
                                    setSuccess(t('classes.createdNamed', { name: created.name }));
                                    setRefreshVersion((value) => value + 1);
                                }}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}