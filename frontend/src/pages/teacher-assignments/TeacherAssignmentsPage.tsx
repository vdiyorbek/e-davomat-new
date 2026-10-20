import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpenCheck, Link2, RotateCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearFor, academicYearOptions, formatDate, isValidAcademicYear, todayInTashkent } from '@/lib/date';
import { localizedName } from '@/lib/localized';
import { personFullName } from '@/lib/person';
import type { School } from '@/types/school';

interface SchoolClass {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
    gradeLevel: number | null;
}

interface Subject {
    id: number;
    code: string;
    nameUz: string;
    isActive: boolean;
}

interface TeacherMembership {
    id: number;
    schoolId: number;
    type: 'TEACHER';
    startDate: string;
    endDate: string | null;
    person: { id: number; firstName: string; lastName: string; middleName: string | null };
}

interface MembershipPage {
    data: TeacherMembership[];
    page: number;
    total: number;
    totalPages: number;
}

interface TeacherAssignment {
    id: number;
    teacherMembershipId: number;
    teacher: { personId: number; firstName: string; lastName: string; middleName: string | null };
    class: { id: number; name: string; gradeLevel: number | null };
    subject: { id: number; code: string; nameUz: string };
    startDate: string;
    endDate: string | null;
}

function AssignmentsForSchool({ schoolId, academicYear }: { schoolId: number; academicYear: string }) {
    const { t } = useTranslation();
    const id = useId();
    const classesQuery = useApiQuery<SchoolClass[]>(`/classes?schoolId=${schoolId}&academicYear=${academicYear}`);
    const subjectsQuery = useApiQuery<Subject[]>('/subjects');
    const assignmentsQuery = useApiQuery<TeacherAssignment[]>(`/teacher-assignments?schoolId=${schoolId}&academicYear=${academicYear}`);

    const [searchText, setSearchText] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [teacherPage, setTeacherPage] = useState(1);
    const [teacherMembershipId, setTeacherMembershipId] = useState('');
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [startDate, setStartDate] = useState(todayInTashkent);
    const [endDate, setEndDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const teacherParams = new URLSearchParams({
        schoolId: String(schoolId),
        type: 'TEACHER',
        status: 'ACTIVE',
        page: String(teacherPage),
        limit: '100',
    });
    if (appliedSearch) teacherParams.set('q', appliedSearch);
    const teachersQuery = useApiQuery<MembershipPage>(`/school-memberships?${teacherParams.toString()}`);

    const teachers = teachersQuery.data?.data ?? [];
    const classes = classesQuery.data ?? [];
    const subjects = (subjectsQuery.data ?? []).filter((subject) => subject.isActive);
    const assignments = assignmentsQuery.data ?? [];

    function applyTeacherSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setTeacherMembershipId('');
        setTeacherPage(1);
        setAppliedSearch(searchText.trim());
    }

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        setSuccess('');

        if (!teacherMembershipId || !classId || !subjectId || !startDate) return setError(t('assignments.errors.required'));
        if (endDate && endDate <= startDate) return setError(t('members.end.errorBeforeStart'));

        setBusy(true);
        try {
            await authorizedPost('/teacher-assignments', {
                teacherMembershipId: Number(teacherMembershipId),
                classId: Number(classId),
                subjectId: Number(subjectId),
                startDate,
                ...(endDate ? { endDate } : {}),
            });
            setSuccess(t('assignments.created'));
            assignmentsQuery.retry();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('assignments.createFailed'));
        } finally {
            setBusy(false);
        }
    }

    const loadErrors = [
        teachersQuery.error && `${t('nav.items.teachers')}: ${teachersQuery.error}`,
        classesQuery.error && `${t('nav.items.classes')}: ${classesQuery.error}`,
        subjectsQuery.error && `${t('assignments.subjects')}: ${subjectsQuery.error}`,
    ].filter(Boolean);

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('assignments.createTitle')}</CardTitle>
                    <CardDescription>{t('assignments.createHint')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={applyTeacherSearch}>
                        <Field htmlFor={`${id}-search`} label={t('assignments.searchTeacher')}>
                            <div className="flex gap-2">
                                <Input
                                    id={`${id}-search`}
                                    type="search"
                                    value={searchText}
                                    onChange={(event) => setSearchText(event.target.value)}
                                    maxLength={100}
                                    placeholder={t('attendance.searchPlaceholder')}
                                />
                                <Button type="submit" variant="outline" size="icon" className="size-11 shrink-0 bg-card" aria-label={t('common.search')}>
                                    <Search aria-hidden="true" />
                                </Button>
                            </div>
                        </Field>
                    </form>

                    <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
                        <Field
                            htmlFor={`${id}-teacher`}
                            label={t('assignments.teacher')}
                            required
                            hint={!teachersQuery.loading && !teachersQuery.error && teachers.length === 0 ? t('assignments.noTeachers') : undefined}
                        >
                            <SelectField
                                id={`${id}-teacher`}
                                value={teacherMembershipId}
                                onValueChange={setTeacherMembershipId}
                                disabled={busy || teachersQuery.loading || Boolean(teachersQuery.error)}
                                placeholder={teachersQuery.loading ? t('common.loading') : t('assignments.chooseTeacher')}
                                required
                                options={teachers.map((item) => ({ value: String(item.id), label: personFullName(item.person) }))}
                            />
                            {teachersQuery.data && teachersQuery.data.totalPages > 1 && (
                                <Pagination
                                    page={teacherPage}
                                    totalPages={teachersQuery.data.totalPages}
                                    onPageChange={(next) => {
                                        setTeacherMembershipId('');
                                        setTeacherPage(next);
                                    }}
                                />
                            )}
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                            <Field htmlFor={`${id}-class`} label={t('common.class')} required>
                                <SelectField
                                    id={`${id}-class`}
                                    value={classId}
                                    onValueChange={setClassId}
                                    disabled={busy || classesQuery.loading || Boolean(classesQuery.error)}
                                    placeholder={t('members.chooseClass')}
                                    required
                                    options={classes.map((item) => ({
                                        value: String(item.id),
                                        label: item.gradeLevel ? `${item.name} (${t('calendar.gradeN', { grade: item.gradeLevel })})` : item.name,
                                    }))}
                                />
                            </Field>
                            <Field htmlFor={`${id}-subject`} label={t('assignments.subject')} required>
                                <SelectField
                                    id={`${id}-subject`}
                                    value={subjectId}
                                    onValueChange={setSubjectId}
                                    disabled={busy || subjectsQuery.loading || Boolean(subjectsQuery.error)}
                                    placeholder={t('assignments.chooseSubject')}
                                    required
                                    options={subjects.map((item) => ({ value: String(item.id), label: localizedName(item) }))}
                                />
                            </Field>
                            <Field htmlFor={`${id}-start`} label={t('membership.startDate')} required>
                                <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy} required />
                            </Field>
                            <Field htmlFor={`${id}-end`} label={`${t('membership.endDate')} (${t('common.optional')})`}>
                                <Input id={`${id}-end`} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy} />
                            </Field>
                        </div>

                        {loadErrors.map((message) => (
                            <ErrorState key={message as string} message={message} />
                        ))}
                        {error && <ErrorState message={error} />}
                        {success && <SuccessNotice>{success}</SuccessNotice>}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={
                                busy || !teacherMembershipId || !classId || !subjectId || !startDate ||
                                classesQuery.loading || subjectsQuery.loading || teachersQuery.loading
                            }
                        >
                            <Link2 aria-hidden="true" />
                            {busy ? t('common.saving') : t('assignments.submit')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-heading text-lg font-semibold">{t('assignments.listTitle')}</h2>
                        <p className="text-sm text-muted-foreground">{t('common.total', { count: assignments.length })}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={assignmentsQuery.retry} disabled={assignmentsQuery.loading}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {assignmentsQuery.loading ? (
                    <LoadingState rows={4} />
                ) : assignmentsQuery.error ? (
                    <ErrorState message={assignmentsQuery.error} onRetry={assignmentsQuery.retry} />
                ) : assignments.length === 0 ? (
                    <EmptyState icon={BookOpenCheck} title={t('assignments.emptyTitle')} description={t('assignments.empty')} />
                ) : (
                    <>
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {assignments.map((item) => (
                                <li key={item.id}>
                                    <Card size="sm" className="gap-3 px-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold [overflow-wrap:anywhere]">{personFullName(item.teacher)}</p>
                                            <StatusBadge tone={item.endDate ? 'neutral' : 'success'}>
                                                {item.endDate ? t('common.membershipStatus.ENDED') : t('common.membershipStatus.ACTIVE')}
                                            </StatusBadge>
                                        </div>
                                        <DetailList>
                                            <DetailItem label={t('common.class')}>{item.class.name}</DetailItem>
                                            <DetailItem label={t('assignments.subject')}>{localizedName(item.subject)}</DetailItem>
                                            <DetailItem label={t('membership.start')}>{formatDate(item.startDate)}</DetailItem>
                                            <DetailItem label={t('membership.endDate')}>{item.endDate ? formatDate(item.endDate) : t('assignments.ongoing')}</DetailItem>
                                        </DetailList>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                        <Card className="hidden py-0 xl:flex">
                            <Table className="min-w-[680px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-5">{t('assignments.teacher')}</TableHead>
                                        <TableHead>{t('common.class')}</TableHead>
                                        <TableHead>{t('assignments.subject')}</TableHead>
                                        <TableHead>{t('membership.start')}</TableHead>
                                        <TableHead className="pr-5">{t('membership.endDate')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignments.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="pl-5 font-semibold">{personFullName(item.teacher)}</TableCell>
                                            <TableCell>{item.class.name}</TableCell>
                                            <TableCell>{localizedName(item.subject)}</TableCell>
                                            <TableCell className="tabular-nums">{formatDate(item.startDate)}</TableCell>
                                            <TableCell className="pr-5 tabular-nums">
                                                {item.endDate ? formatDate(item.endDate) : <StatusBadge tone="success">{t('assignments.ongoing')}</StatusBadge>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                )}
            </section>
        </div>
    );
}

export function TeacherAssignmentsPage() {
    const { t } = useTranslation();
    const id = useId();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [schoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(todayInTashkent()));
    const schools = schoolsQuery.data ?? [];
    const school = schools.find((item) => String(item.id) === schoolId);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('assignments.title')} description={t('assignments.subtitle')} />
            <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field htmlFor={`${id}-school`} label={t('common.school')} error={schoolsQuery.error || undefined}>
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={setSchoolId}
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error)}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        options={schools.map((item) => ({ value: String(item.id), label: `${item.name} — ${item.district.name}` }))}
                    />
                </Field>
                <Field htmlFor={`${id}-year`} label={t('members.academicYear')}>
                    <SelectField
                        id={`${id}-year`}
                        value={academicYear}
                        onValueChange={setAcademicYear}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>
            </div>
            {school && isValidAcademicYear(academicYear) ? (
                <AssignmentsForSchool key={`${school.id}-${academicYear}`} schoolId={school.id} academicYear={academicYear} />
            ) : (
                !schoolsQuery.loading && <EmptyState icon={BookOpenCheck} title={t('calendar.chooseTitle')} description={t('assignments.choose')} />
            )}
        </div>
    );
}
