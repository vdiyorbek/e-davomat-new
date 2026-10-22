
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
    CalendarDays,
    Plus,
    RotateCw,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import {
    EmptyState,
    ErrorState,
    LoadingState,
    SuccessNotice,
} from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import {
    academicYearFor,
    academicYearOptions,
    todayInTashkent,
} from '@/lib/date';
import type { School } from '@/types/school';

interface SchoolClass {
    id: number;
    schoolId: number;
    name: string;
    academicYear: string;
    gradeLevel: number | null;
}
import { LessonScheduleActions } from './LessonScheduleActions';
interface TeacherAssignment {
    id: number;
    teacherMembershipId: number;
    class: {
        id: number;
        name: string;
    };
    subject: {
        id: number;
        nameUz: string;
    };
    teacher: {
        firstName: string;
        lastName: string;
        middleName: string | null;
    };
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
    subject: {
        id: number;
        nameUz: string;
    };
    teacher: {
        firstName: string;
        lastName: string;
        middleName: string | null;
    };
}

const DAYS = [
    'Dushanba',
    'Seshanba',
    'Chorshanba',
    'Payshanba',
    'Juma',
    'Shanba',
];

function teacherName(person: {
    firstName: string;
    lastName: string;
    middleName: string | null;
}) {
    return [
        person.lastName,
        person.firstName,
        person.middleName,
    ]
        .filter(Boolean)
        .join(' ');
}

function SchoolSchedule({
    schoolId,
    academicYear,
}: {
    schoolId: number;
    academicYear: string;
}) {
    const id = useId();

    const [classId, setClassId] = useState('');

    const classesQuery = useApiQuery<SchoolClass[]>(
        `/classes?schoolId=${schoolId}&academicYear=${academicYear}`,
    );

    const assignmentsQuery = useApiQuery<TeacherAssignment[]>(
        `/teacher-assignments?schoolId=${schoolId}&academicYear=${academicYear}`,
    );

    const classes = classesQuery.data ?? [];
    const selectedClass = classes.find(
        (item) => String(item.id) === classId,
    );

    return (
        <div className="space-y-5">
            <Card>
                <CardContent>
                    <Field
                        htmlFor={`${id}-class`}
                        label="Sinfni tanlang"
                    >
                        <SelectField
                            id={`${id}-class`}
                            value={classId}
                            onValueChange={setClassId}
                            placeholder="Sinfni tanlang"
                            disabled={classesQuery.loading}
                            options={classes.map((item) => ({
                                value: String(item.id),
                                label: item.name,
                            }))}
                        />
                    </Field>

                    {classesQuery.error && (
                        <ErrorState
                            message={classesQuery.error}
                            onRetry={classesQuery.retry}
                        />
                    )}
                </CardContent>
            </Card>

            {selectedClass && (
                <ClassSchedule
                    key={selectedClass.id}
                    schoolId={schoolId}
                    academicYear={academicYear}
                    schoolClass={selectedClass}
                    assignments={assignmentsQuery.data ?? []}
                    assignmentsLoading={assignmentsQuery.loading}
                    assignmentsError={assignmentsQuery.error}
                />
            )}
        </div>
    );
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
    const id = useId();

    const params = new URLSearchParams({
        schoolId: String(schoolId),
        academicYear,
        classId: String(schoolClass.id),
    });

    const query = useApiQuery<LessonSchedule[]>(
        `/lesson-schedules?${params.toString()}`,
    );

    const [assignmentId, setAssignmentId] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState('1');
    const [lessonNumber, setLessonNumber] = useState('1');

    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('08:45');

    const startYear = Number(academicYear.slice(0, 4));
    const endYear = startYear + 1;

    const [startDate, setStartDate] = useState(
        `${startYear}-09-01`,
    );

    const [endDate, setEndDate] = useState(
        `${endYear}-06-01`,
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const availableAssignments = assignments.filter(
        (item) => item.class.id === schoolClass.id,
    );

    const lessons = query.data ?? [];

    async function handleCreate(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (busy) return;

        setError('');
        setSuccess('');

        if (!assignmentId) {
            setError('Fan va o‘qituvchini tanlang.');
            return;
        }

        if (startTime >= endTime) {
            setError('Dars tugash vaqti noto‘g‘ri.');
            return;
        }

        if (endDate && endDate <= startDate) {
            setError('Tugash sanasi noto‘g‘ri.');
            return;
        }

        setBusy(true);

        try {
            await authorizedPost('/lesson-schedules', {
                classId: schoolClass.id,
                teacherAssignmentId: Number(assignmentId),
                dayOfWeek: Number(dayOfWeek),
                lessonNumber: Number(lessonNumber),
                startTime,
                endTime,
                startDate,
                ...(endDate ? { endDate } : {}),
            });

            setSuccess('Dars jadvalga muvaffaqiyatli qo‘shildi.');

            setAssignmentId('');
            setLessonNumber(String(Number(lessonNumber) + 1));

            query.retry();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Darsni qo‘shishda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle className="text-lg">
                        Yangi dars qo‘shish
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <form
                        onSubmit={(event) => void handleCreate(event)}
                        className="space-y-4"
                    >
                        <Field
                            htmlFor={`${id}-assignment`}
                            label="Fan va o‘qituvchi"
                            required
                        >
                            <SelectField
                                id={`${id}-assignment`}
                                value={assignmentId}
                                onValueChange={setAssignmentId}
                                placeholder="Tanlang"
                                required
                                disabled={busy || assignmentsLoading}
                                options={availableAssignments.map((item) => ({
                                    value: String(item.id),
                                    label: `${item.subject.nameUz} — ${teacherName(item.teacher)}`,
                                }))}
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-day`}
                            label="Hafta kuni"
                            required
                        >
                            <SelectField
                                id={`${id}-day`}
                                value={dayOfWeek}
                                onValueChange={setDayOfWeek}
                                options={DAYS.map((day, index) => ({
                                    value: String(index + 1),
                                    label: day,
                                }))}
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-number`}
                            label="Dars raqami"
                            required
                        >
                            <Input
                                id={`${id}-number`}
                                type="number"
                                min={1}
                                max={20}
                                value={lessonNumber}
                                onChange={(event) =>
                                    setLessonNumber(event.target.value)
                                }
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                htmlFor={`${id}-start-time`}
                                label="Boshlanish"
                                required
                            >
                                <Input
                                    id={`${id}-start-time`}
                                    type="time"
                                    value={startTime}
                                    onChange={(event) =>
                                        setStartTime(event.target.value)
                                    }
                                    required
                                />
                            </Field>

                            <Field
                                htmlFor={`${id}-end-time`}
                                label="Tugash"
                                required
                            >
                                <Input
                                    id={`${id}-end-time`}
                                    type="time"
                                    value={endTime}
                                    onChange={(event) =>
                                        setEndTime(event.target.value)
                                    }
                                    required
                                />
                            </Field>
                        </div>

                        <Field
                            htmlFor={`${id}-start-date`}
                            label="Amal qilish boshlanishi"
                            required
                        >
                            <Input
                                id={`${id}-start-date`}
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    setStartDate(event.target.value)
                                }
                                required
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-end-date`}
                            label="Amal qilish tugashi (ixtiyoriy)"
                        >
                            <Input
                                id={`${id}-end-date`}
                                type="date"
                                value={endDate}
                                onChange={(event) =>
                                    setEndDate(event.target.value)
                                }
                            />
                        </Field>

                        {assignmentsError && (
                            <ErrorState message={assignmentsError} />
                        )}

                        {!assignmentsLoading &&
                            !assignmentsError &&
                            availableAssignments.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Bu sinfga hali fan va o‘qituvchi
                                    biriktirilmagan.
                                </p>
                            )}

                        {error && <ErrorState message={error} />}

                        {success && (
                            <SuccessNotice>{success}</SuccessNotice>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={
                                busy ||
                                assignmentsLoading ||
                                Boolean(assignmentsError) ||
                                !assignmentId
                            }
                        >
                            <Plus aria-hidden="true" />
                            {busy ? 'Saqlanmoqda...' : 'Dars qo‘shish'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {schoolClass.name} — Haftalik dars jadvali
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Jami: {lessons.length} ta jadval yozuvi
                        </p>
                    </div>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={query.retry}
                        disabled={query.loading}
                    >
                        <RotateCw aria-hidden="true" />
                        Yangilash
                    </Button>
                </div>

                {query.loading ? (
                    <LoadingState rows={6} />
                ) : query.error ? (
                    <ErrorState
                        message={query.error}
                        onRetry={query.retry}
                    />
                ) : lessons.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title="Dars jadvali bo‘sh"
                        description="Ushbu sinf uchun darslar qo‘shilmagan."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {DAYS.map((day, index) => {
                            const dayLessons = lessons.filter(
                                (lesson) => lesson.dayOfWeek === index + 1,
                            );

                            return (
                                <Card key={day} className="min-w-0">
                                    <CardHeader>
                                        <CardTitle className="text-base">
                                            {day}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-3">
                                        {dayLessons.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Dars yo‘q
                                            </p>
                                        ) : (
                                            dayLessons.map((lesson) => (
                                                <div
                                                    key={lesson.id}
                                                    className="rounded-xl border p-3"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">
                                                            {lesson.lessonNumber}
                                                        </span>

                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold break-words">
                                                                {lesson.subject.nameUz}
                                                            </p>

                                                            <p className="mt-1 text-xs text-muted-foreground break-words">
                                                                {teacherName(lesson.teacher)}
                                                            </p>

                                                            <p className="mt-2 text-sm font-medium tabular-nums">
                                                                {lesson.startTime.slice(0, 5)}
                                                                {' – '}
                                                                {lesson.endTime.slice(0, 5)}
                                                            </p>

                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {lesson.startDate}
                                                                {' → '}
                                                                {lesson.endDate ?? 'Muddatsiz'}
                                                            </p>

                                                            <LessonScheduleActions
                                                                lesson={lesson}
                                                                onUpdated={query.retry}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
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

export function LessonSchedulesPage() {
    const id = useId();

    const schoolsQuery = useApiQuery<School[]>('/schools');

    const [schoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(
        () => academicYearFor(todayInTashkent()),
    );

    const schools = schoolsQuery.data ?? [];

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Professional ta’lim"
                title="Dars jadvali"
                description="Sinflarning haftalik dars jadvalini boshqarish"
            />

            <Card>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field
                            htmlFor={`${id}-school`}
                            label="Maktab"
                        >
                            <SelectField
                                id={`${id}-school`}
                                value={schoolId}
                                onValueChange={setSchoolId}
                                placeholder="Maktabni tanlang"
                                disabled={schoolsQuery.loading}
                                options={schools.map((school) => ({
                                    value: String(school.id),
                                    label: school.name,
                                }))}
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-year`}
                            label="O‘quv yili"
                        >
                            <SelectField
                                id={`${id}-year`}
                                value={academicYear}
                                onValueChange={setAcademicYear}
                                options={academicYearOptions(academicYear).map(
                                    (year) => ({
                                        value: year,
                                        label: year,
                                    }),
                                )}
                            />
                        </Field>
                    </div>

                    {schoolsQuery.error && (
                        <ErrorState
                            message={schoolsQuery.error}
                            onRetry={schoolsQuery.retry}
                        />
                    )}
                </CardContent>
            </Card>

            {schoolId ? (
                <SchoolSchedule
                    key={`${schoolId}-${academicYear}`}
                    schoolId={Number(schoolId)}
                    academicYear={academicYear}
                />
            ) : (
                <EmptyState
                    icon={CalendarDays}
                    title="Dars jadvalini tanlang"
                    description="Avval maktab va o‘quv yilini tanlang."
                />
            )}
        </div>
    );
}
