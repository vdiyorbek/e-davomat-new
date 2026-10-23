import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, CalendarDays, History, Plus, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearFor, academicYearOptions, formatDate, todayInTashkent, weekdayName } from '@/lib/date';
import { localizedName } from '@/lib/localized';
import { personFullName } from '@/lib/person';
import type { School } from '@/types/school';

import { LessonScheduleActions } from './LessonScheduleActions';
import { SCHOOL_DAYS, shortTime } from './schedule-utils';

interface SchoolClass {
    id: number;
    schoolId: number;
    name: string;
    academicYear: string;
    gradeLevel: number | null;
}

interface PersonName {
    firstName: string;
    lastName: string;
    middleName: string | null;
}

interface TeacherAssignment {
    id: number;
    teacherMembershipId: number;
    class: { id: number; name: string };
    subject: { id: number; nameUz: string };
    teacher: PersonName;
    startDate: string;
    endDate: string | null;
}

interface LessonSchedule {
    id: number;
    classId: number;
    teacherAssignmentId: number;
    dayOfWeek: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string | null;
    subject: { id: number; nameUz: string };
    teacher: PersonName;
}

function ClassSchedule({
    schoolId,
    academicYear,
    schoolClass,
    assignments,
    assignmentsLoading,
    assignmentsError,
}: {
    schoolId: number;
    academicYear: string;
    schoolClass: SchoolClass;
    assignments: TeacherAssignment[];
    assignmentsLoading: boolean;
    assignmentsError: string;
}) {
    const { t } = useTranslation();
    const id = useId();
    const today = todayInTashkent();
    const startYear = Number(academicYear.slice(0, 4));
    const yearMin = `${startYear}-09-01`;
    const yearMax = `${startYear + 1}-08-31`;

    const [viewMode, setViewMode] = useState<'date' | 'all'>('date');
    const [selectedDate, setSelectedDate] = useState(() => (today >= yearMin && today <= yearMax ? today : yearMin));

    const params = new URLSearchParams({ schoolId: String(schoolId), academicYear, classId: String(schoolClass.id) });
    if (viewMode === 'date' && selectedDate) params.set('date', selectedDate);
    const query = useApiQuery<LessonSchedule[]>(`/lesson-schedules?${params.toString()}`);

    const [assignmentId, setAssignmentId] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState('1');
    const [lessonNumber, setLessonNumber] = useState('1');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('08:45');
    const [startDate, setStartDate] = useState(yearMin);
    const [endDate, setEndDate] = useState(`${startYear + 1}-06-01`);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const availableAssignments = assignments.filter((item) => item.class.id === schoolClass.id);
    const lessons = query.data ?? [];
    const editable = viewMode === 'date' && selectedDate >= today;

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        setSuccess('');

        const number = Number(lessonNumber);
        if (!assignmentId) return setError(t('schedule.errors.assignment'));
        if (!Number.isInteger(number) || number < 1 || number > 20) return setError(t('schedule.errors.lessonNumber'));
        if (startTime >= endTime) return setError(t('schedule.errors.time'));
        if (endDate && endDate <= startDate) return setError(t('members.end.errorBeforeStart'));

        setBusy(true);
        try {
            await authorizedPost('/lesson-schedules', {
                classId: schoolClass.id,
                teacherAssignmentId: Number(assignmentId),
                dayOfWeek: Number(dayOfWeek),
                lessonNumber: number,
                startTime,
                endTime,
                startDate,
                ...(endDate ? { endDate } : {}),
            });
            setSuccess(t('schedule.created'));
            setAssignmentId('');
            setLessonNumber(String(Math.min(number + 1, 20)));
            query.retry();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('schedule.errors.createFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit xl:sticky xl:top-24">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('schedule.createTitle')}</CardTitle>
                    <CardDescription>{t('schedule.createHint', { name: schoolClass.name })}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
                        <fieldset disabled={busy} className="space-y-4">
                            <Field
                                htmlFor={`${id}-assignment`}
                                label={t('schedule.assignment')}
                                required
                                error={assignmentsError || undefined}
                                hint={!assignmentsLoading && !assignmentsError && availableAssignments.length === 0 ? t('schedule.noAssignments') : undefined}
                            >
                                <SelectField
                                    id={`${id}-assignment`}
                                    value={assignmentId}
                                    onValueChange={setAssignmentId}
                                    placeholder={assignmentsLoading ? t('common.loading') : t('schedule.chooseAssignment')}
                                    required
                                    disabled={assignmentsLoading || availableAssignments.length === 0}
                                    options={availableAssignments.map((item) => ({
                                        value: String(item.id),
                                        label: `${localizedName(item.subject)} — ${personFullName(item.teacher)}`,
                                    }))}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field htmlFor={`${id}-day`} label={t('schedule.weekday')} required>
                                    <SelectField
                                        id={`${id}-day`}
                                        value={dayOfWeek}
                                        onValueChange={setDayOfWeek}
                                        options={SCHOOL_DAYS.map((day) => ({ value: String(day), label: weekdayName(day - 1) }))}
                                    />
                                </Field>
                                <Field htmlFor={`${id}-number`} label={t('schedule.lessonNumber')} required>
                                    <Input
                                        id={`${id}-number`}
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={20}
                                        value={lessonNumber}
                                        onChange={(event) => setLessonNumber(event.target.value)}
                                        required
                                    />
                                </Field>
                                <Field htmlFor={`${id}-start-time`} label={t('schedule.startTime')} required>
                                    <Input id={`${id}-start-time`} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                                </Field>
                                <Field htmlFor={`${id}-end-time`} label={t('schedule.endTime')} required>
                                    <Input id={`${id}-end-time`} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                                </Field>
                                <Field htmlFor={`${id}-start-date`} label={t('schedule.validFrom')} required>
                                    <Input
                                        id={`${id}-start-date`}
                                        type="date"
                                        min={yearMin}
                                        max={yearMax}
                                        value={startDate}
                                        onChange={(event) => setStartDate(event.target.value)}
                                        required
                                    />
                                </Field>
                                <Field htmlFor={`${id}-end-date`} label={`${t('schedule.validTo')} (${t('common.optional')})`}>
                                    <Input
                                        id={`${id}-end-date`}
                                        type="date"
                                        min={startDate}
                                        max={yearMax}
                                        value={endDate}
                                        onChange={(event) => setEndDate(event.target.value)}
                                    />
                                </Field>
                            </div>
                        </fieldset>

                        {error && <ErrorState message={error} />}
                        {success && <SuccessNotice>{success}</SuccessNotice>}

                        <Button type="submit" className="w-full" disabled={busy || assignmentsLoading || Boolean(assignmentsError) || !assignmentId}>
                            <Plus aria-hidden="true" />
                            {busy ? t('common.saving') : t('schedule.add')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-heading text-lg font-bold">{t('schedule.weekTitle', { name: schoolClass.name })}</h2>
                        <p className="text-sm text-muted-foreground">{t('schedule.total', { count: lessons.length })}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={query.retry} disabled={query.loading}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'date' | 'all')}>
                        <TabsList className="w-full sm:w-fit">
                            <TabsTrigger value="date">
                                <CalendarDays aria-hidden="true" />
                                {t('schedule.view.date')}
                            </TabsTrigger>
                            <TabsTrigger value="all">
                                <History aria-hidden="true" />
                                {t('schedule.view.all')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {viewMode === 'date' && (
                        <Field htmlFor={`${id}-history-date`} label={t('schedule.view.dateLabel')} className="sm:w-56">
                            <Input
                                id={`${id}-history-date`}
                                type="date"
                                min={yearMin}
                                max={yearMax}
                                value={selectedDate}
                                onChange={(event) => setSelectedDate(event.target.value)}
                            />
                        </Field>
                    )}
                </div>

                {query.loading ? (
                    <LoadingState rows={6} />
                ) : query.error ? (
                    <ErrorState message={query.error} onRetry={query.retry} />
                ) : lessons.length === 0 ? (
                    <EmptyState icon={CalendarClock} title={t('schedule.emptyTitle')} description={t('schedule.empty')} />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {SCHOOL_DAYS.map((day) => {
                            const dayLessons = lessons
                                .filter((lesson) => lesson.dayOfWeek === day)
                                .sort((a, b) => a.lessonNumber - b.lessonNumber || a.startDate.localeCompare(b.startDate));

                            return (
                                <Card key={day} size="sm" className="min-w-0 gap-3">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="text-base font-semibold">{weekdayName(day - 1)}</CardTitle>
                                        <span className="text-xs text-muted-foreground">{t('schedule.lessonsCount', { count: dayLessons.length })}</span>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5">
                                        {dayLessons.length === 0 ? (
                                            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                                                {t('schedule.noLessons')}
                                            </p>
                                        ) : (
                                            dayLessons.map((lesson) => (
                                                <article key={lesson.id} className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3">
                                                    <span className="bg-brand-gradient grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white">
                                                        {lesson.lessonNumber}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold [overflow-wrap:anywhere]">{localizedName(lesson.subject)}</p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{personFullName(lesson.teacher)}</p>
                                                        <p className="mt-2 text-sm font-medium tabular-nums">
                                                            {shortTime(lesson.startTime)} – {shortTime(lesson.endTime)}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                                            {formatDate(lesson.startDate)} → {lesson.endDate ? formatDate(lesson.endDate) : t('schedule.openEnded')}
                                                        </p>
                                                        {editable && (!lesson.endDate || lesson.endDate > today) && (
                                                            <LessonScheduleActions lesson={lesson} onUpdated={query.retry} />
                                                        )}
                                                    </div>
                                                </article>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

function SchoolSchedule({ schoolId, academicYear }: { schoolId: number; academicYear: string }) {
    const { t } = useTranslation();
    const id = useId();
    const [classId, setClassId] = useState('');
    const classesQuery = useApiQuery<SchoolClass[]>(`/classes?schoolId=${schoolId}&academicYear=${academicYear}`);
    const assignmentsQuery = useApiQuery<TeacherAssignment[]>(`/teacher-assignments?schoolId=${schoolId}&academicYear=${academicYear}`);

    const classes = classesQuery.data ?? [];
    const selectedClass = classes.find((item) => String(item.id) === classId);

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                <Field
                    htmlFor={`${id}-class`}
                    label={t('common.class')}
                    error={classesQuery.error || undefined}
                    hint={!classesQuery.loading && !classesQuery.error && classes.length === 0 ? t('classes.empty') : undefined}
                    className="sm:max-w-sm"
                >
                    <SelectField
                        id={`${id}-class`}
                        value={classId}
                        onValueChange={setClassId}
                        placeholder={classesQuery.loading ? t('common.loading') : t('members.chooseClass')}
                        disabled={classesQuery.loading || Boolean(classesQuery.error)}
                        options={classes.map((item) => ({ value: String(item.id), label: item.name }))}
                    />
                </Field>
            </div>

            {selectedClass ? (
                <ClassSchedule
                    key={selectedClass.id}
                    schoolId={schoolId}
                    academicYear={academicYear}
                    schoolClass={selectedClass}
                    assignments={assignmentsQuery.data ?? []}
                    assignmentsLoading={assignmentsQuery.loading}
                    assignmentsError={assignmentsQuery.error}
                />
            ) : (
                !classesQuery.loading && <EmptyState icon={CalendarClock} title={t('members.chooseClass')} description={t('schedule.chooseClass')} />
            )}
        </div>
    );
}

export function LessonSchedulesPage() {
    const { t } = useTranslation();
    const id = useId();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [pickedSchoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(todayInTashkent()));
    const schools = schoolsQuery.data ?? [];
    // Bitta maktab bo‘lsa (masalan, maktab administratori), u avtomatik tanlanadi.
    const schoolId = pickedSchoolId || (schools.length === 1 ? String(schools[0].id) : '');

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('schedule.title')} description={t('schedule.subtitle')} />

            <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field htmlFor={`${id}-school`} label={t('common.school')} error={schoolsQuery.error || undefined}>
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={setSchoolId}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error)}
                        options={schools.map((school) => ({ value: String(school.id), label: `${school.name} — ${school.district.name}` }))}
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

            {schoolId ? (
                <SchoolSchedule key={`${schoolId}-${academicYear}`} schoolId={Number(schoolId)} academicYear={academicYear} />
            ) : (
                <EmptyState icon={CalendarClock} title={t('calendar.chooseTitle')} description={t('schedule.chooseSchool')} />
            )}
        </div>
    );
}
