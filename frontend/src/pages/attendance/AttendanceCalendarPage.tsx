import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, CalendarRange, PartyPopper, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CalendarSpecialDays } from '@/components/attendance/CalendarSpecialDays';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearFor, academicYearOptions, formatDate, isValidAcademicYear, todayInTashkent, weekdayName } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { School } from '@/types/school';

type MembershipType = 'STUDENT' | 'TEACHER';

interface WeeklySchedule {
    id: number;
    schoolId: number;
    academicYear: string;
    membershipType: MembershipType;
    gradeFrom: number | null;
    gradeTo: number | null;
    classId: number | null;
    workingDaysMask: number;
    effectiveFrom: string;
    effectiveTo: string | null;
}

const WEEK = [0, 1, 2, 3, 4, 5, 6];
const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));

function formatDays(mask: number) {
    return WEEK.filter((index) => (mask & (1 << index)) !== 0)
        .map((index) => weekdayName(index, 'short'))
        .join(', ');
}

function WeeklySchedules({ schoolId, academicYear }: { schoolId: number; academicYear: string }) {
    const { t } = useTranslation();
    const id = useId();
    const query = useApiQuery<WeeklySchedule[]>(
        `/attendance-calendar/weekly-schedules?schoolId=${schoolId}&academicYear=${academicYear}`,
    );

    const [membershipType, setMembershipType] = useState<MembershipType>('STUDENT');
    const [gradeFrom, setGradeFrom] = useState('1');
    const [gradeTo, setGradeTo] = useState('4');
    const [workingDaysMask, setWorkingDaysMask] = useState(31);
    const [effectiveFrom, setEffectiveFrom] = useState(`${academicYear.slice(0, 4)}-09-01`);
    const [effectiveTo, setEffectiveTo] = useState(`${academicYear.slice(5)}-08-31`);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const saving = useRef(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');
        setSuccess('');

        if (workingDaysMask === 0) return setError(t('calendar.weekly.errors.noDays'));
        if (effectiveTo && effectiveTo < effectiveFrom) return setError(t('calendar.errors.range'));
        if (membershipType === 'STUDENT' && Number(gradeFrom) > Number(gradeTo)) return setError(t('calendar.weekly.errors.grades'));

        saving.current = true;
        setBusy(true);
        try {
            await authorizedPost('/attendance-calendar/weekly-schedules', {
                schoolId,
                academicYear,
                membershipType,
                ...(membershipType === 'STUDENT' ? { gradeFrom: Number(gradeFrom), gradeTo: Number(gradeTo) } : {}),
                workingDaysMask,
                effectiveFrom,
                ...(effectiveTo ? { effectiveTo } : {}),
            });
            setSuccess(t('calendar.weekly.saved'));
            query.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('calendar.weekly.saveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    const gradeOptions = GRADES.map((grade) => ({ value: grade, label: t('calendar.gradeN', { grade }) }));

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('calendar.weekly.createTitle')}</CardTitle>
                    <CardDescription>{t('calendar.weekly.createHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <fieldset disabled={busy} className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Field htmlFor={`${id}-who`} label={t('calendar.audience')}>
                                    <SelectField
                                        id={`${id}-who`}
                                        value={membershipType}
                                        onValueChange={(value) => setMembershipType(value as MembershipType)}
                                        options={[
                                            { value: 'STUDENT', label: t('calendar.audiences.STUDENT') },
                                            { value: 'TEACHER', label: t('calendar.audiences.TEACHER') },
                                        ]}
                                    />
                                </Field>
                                {membershipType === 'STUDENT' && (
                                    <>
                                        <Field htmlFor={`${id}-from`} label={t('calendar.weekly.gradeFrom')}>
                                            <SelectField id={`${id}-from`} value={gradeFrom} onValueChange={setGradeFrom} options={gradeOptions} />
                                        </Field>
                                        <Field htmlFor={`${id}-to`} label={t('calendar.weekly.gradeTo')}>
                                            <SelectField id={`${id}-to`} value={gradeTo} onValueChange={setGradeTo} options={gradeOptions} />
                                        </Field>
                                    </>
                                )}
                            </div>

                            <fieldset className="space-y-3">
                                <legend className="mb-2 text-sm font-semibold">{t('calendar.weekly.workingDays')}</legend>
                                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                                    {WEEK.map((index) => {
                                        const checked = (workingDaysMask & (1 << index)) !== 0;
                                        return (
                                            <label
                                                key={index}
                                                className={cn(
                                                    'flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors',
                                                    checked ? 'border-primary bg-primary/10 text-primary dark:text-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
                                                )}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() => setWorkingDaysMask((previous) => previous ^ (1 << index))}
                                                    aria-label={weekdayName(index)}
                                                />
                                                {weekdayName(index, 'short')}
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setWorkingDaysMask(31)}>
                                        {t('calendar.weekly.fiveDay')}
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setWorkingDaysMask(63)}>
                                        {t('calendar.weekly.sixDay')}
                                    </Button>
                                </div>
                            </fieldset>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field htmlFor={`${id}-start`} label={t('membership.startDate')} required>
                                    <Input
                                        id={`${id}-start`}
                                        type="date"
                                        value={effectiveFrom}
                                        min={`${academicYear.slice(0, 4)}-09-01`}
                                        max={`${academicYear.slice(5)}-08-31`}
                                        onChange={(event) => setEffectiveFrom(event.target.value)}
                                        required
                                    />
                                </Field>
                                <Field htmlFor={`${id}-end`} label={t('membership.endDate')}>
                                    <Input
                                        id={`${id}-end`}
                                        type="date"
                                        value={effectiveTo}
                                        min={effectiveFrom}
                                        max={`${academicYear.slice(5)}-08-31`}
                                        onChange={(event) => setEffectiveTo(event.target.value)}
                                    />
                                </Field>
                            </div>
                        </fieldset>

                        {error && <ErrorState message={error} />}
                        {success && <SuccessNotice>{success}</SuccessNotice>}

                        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                            {busy ? t('common.saving') : t('calendar.weekly.submit')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-semibold">{t('calendar.weekly.listTitle')}</h2>
                    <Button type="button" variant="outline" size="sm" onClick={query.retry}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {query.loading ? (
                    <LoadingState rows={3} />
                ) : query.error ? (
                    <ErrorState message={query.error} onRetry={query.retry} />
                ) : query.data?.length ? (
                    <Card className="py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-5">{t('calendar.audience')}</TableHead>
                                    <TableHead>{t('calendar.weekly.grades')}</TableHead>
                                    <TableHead>{t('calendar.weekly.workingDays')}</TableHead>
                                    <TableHead className="pr-5">{t('calendar.weekly.period')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {query.data.map((schedule) => (
                                    <TableRow key={schedule.id}>
                                        <TableCell className="pl-5">
                                            <StatusBadge tone={schedule.membershipType === 'STUDENT' ? 'primary' : 'info'} dot={false}>
                                                {t(`calendar.audiences.${schedule.membershipType}`)}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell>
                                            {schedule.classId !== null
                                                ? t('calendar.classId', { id: schedule.classId })
                                                : schedule.gradeFrom !== null && schedule.gradeTo !== null
                                                    ? `${schedule.gradeFrom}–${schedule.gradeTo}`
                                                    : t('common.all')}
                                        </TableCell>
                                        <TableCell className="min-w-40 whitespace-normal">{formatDays(schedule.workingDaysMask)}</TableCell>
                                        <TableCell className="pr-5 tabular-nums">
                                            {formatDate(schedule.effectiveFrom)} — {schedule.effectiveTo ? formatDate(schedule.effectiveTo) : t('calendar.unlimited')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <EmptyState icon={CalendarRange} title={t('calendar.weekly.emptyTitle')} description={t('calendar.weekly.empty')} />
                )}
            </section>
        </div>
    );
}

export function AttendanceCalendarPage() {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(todayInTashkent()));

    const schoolId = selectedSchoolId || (session?.profile.schoolId ? String(session.profile.schoolId) : '');
    const validYear = isValidAcademicYear(academicYear);
    const selectedSchool = (schoolsQuery.data ?? []).find((school) => String(school.id) === schoolId);

    return (
        <div className="space-y-6">
            <PageHeader eyebrow={t('nav.groups.attendance')} title={t('calendar.title')} description={t('calendar.subtitle')} />

            <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field htmlFor={`${id}-school`} label={t('common.school')} error={schoolsQuery.error || undefined}>
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={setSelectedSchoolId}
                        disabled={schoolsQuery.loading}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        options={(schoolsQuery.data ?? []).map((school) => ({
                            value: String(school.id),
                            label: `${school.name} — ${school.district.name}`,
                        }))}
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

            {selectedSchool && validYear ? (
                <Tabs defaultValue="weekly">
                    <TabsList className="w-full sm:w-fit">
                        <TabsTrigger value="weekly">
                            <CalendarRange aria-hidden="true" />
                            {t('calendar.tabs.weekly')}
                        </TabsTrigger>
                        <TabsTrigger value="special">
                            <PartyPopper aria-hidden="true" />
                            {t('calendar.tabs.special')}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="weekly" className="pt-2">
                        <WeeklySchedules key={`${selectedSchool.id}-${academicYear}`} schoolId={selectedSchool.id} academicYear={academicYear} />
                    </TabsContent>
                    <TabsContent value="special" className="pt-2">
                        <CalendarSpecialDays key={`${selectedSchool.id}-${academicYear}`} school={selectedSchool} academicYear={academicYear} />
                    </TabsContent>
                </Tabs>
            ) : (
                <EmptyState icon={CalendarDays} title={t('calendar.chooseTitle')} description={t('calendar.choose')} />
            )}
        </div>
    );
}
