
import { useId, useState } from 'react';
import { BookOpenCheck, Plus, RefreshCw } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';

import { useApiQuery } from '@/hooks/useApiQuery';
import {
    authorizedPatch,
    authorizedPost,
} from '@/lib/auth-session';
import {
    academicYearFor,
    academicYearOptions,
    todayInTashkent,
} from '@/lib/date';
import type { School } from '@/types/school';

interface SchoolClass {
    id: number;
    name: string;
    schoolId: number;
    academicYear: string;
}

interface LessonSchedule {
    id: number;
    lessonNumber: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
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

type SessionStatus =
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED';

interface LessonSession {
    id: number;
    lessonScheduleId: number;
    lessonNumber: number;
    lessonDate: string;
    startTime: string;
    endTime: string;
    topicTitle: string | null;
    homework: string | null;
    teacherNotes: string | null;
    status: SessionStatus;
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

const STATUS_OPTIONS = [
    { value: 'PLANNED', label: 'Rejalashtirilgan' },
    { value: 'IN_PROGRESS', label: 'O‘tilmoqda' },
    { value: 'COMPLETED', label: 'O‘tilgan' },
    { value: 'CANCELLED', label: 'Bekor qilingan' },
];

function fullName(person: {
    firstName: string;
    lastName: string;
    middleName: string | null;
}) {
    return [
        person.lastName,
        person.firstName,
        person.middleName,
    ].filter(Boolean).join(' ');
}

function SessionEditor({
    session,
    onSaved,
}: {
    session: LessonSession;
    onSaved: () => void;
}) {
    const id = useId();

    const [topicTitle, setTopicTitle] = useState(
        session.topicTitle ?? '',
    );
    const [homework, setHomework] = useState(
        session.homework ?? '',
    );
    const [teacherNotes, setTeacherNotes] = useState(
        session.teacherNotes ?? '',
    );
    const [status, setStatus] = useState<SessionStatus>(
        session.status,
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSave() {
        if (saving) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await authorizedPatch(
                `/lesson-sessions/${session.id}`,
                {
                    topicTitle: topicTitle.trim() || null,
                    homework: homework.trim() || null,
                    teacherNotes: teacherNotes.trim() || null,
                    status,
                },
            );

            setSuccess('Dars ma’lumotlari saqlandi.');
            onSaved();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Saqlashda xatolik yuz berdi.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    {session.lessonNumber}-dars — {session.subject.nameUz}
                </CardTitle>

                <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{fullName(session.teacher)}</p>
                    <p>
                        {session.startTime.slice(0, 5)}
                        {' – '}
                        {session.endTime.slice(0, 5)}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <Field
                    htmlFor={`${id}-topic`}
                    label="Dars mavzusi"
                >
                    <Input
                        id={`${id}-topic`}
                        value={topicTitle}
                        onChange={(event) =>
                            setTopicTitle(event.target.value)
                        }
                        maxLength={255}
                        placeholder="Mavzuni kiriting"
                        disabled={saving}
                    />
                </Field>

                <Field
                    htmlFor={`${id}-homework`}
                    label="Uy vazifasi"
                >
                    <Textarea
                        id={`${id}-homework`}
                        value={homework}
                        onChange={(event) =>
                            setHomework(event.target.value)
                        }
                        maxLength={10000}
                        placeholder="Uy vazifasini yozing"
                        disabled={saving}
                    />
                </Field>

                <Field
                    htmlFor={`${id}-notes`}
                    label="O‘qituvchi izohi"
                >
                    <Textarea
                        id={`${id}-notes`}
                        value={teacherNotes}
                        onChange={(event) =>
                            setTeacherNotes(event.target.value)
                        }
                        maxLength={10000}
                        disabled={saving}
                    />
                </Field>

                <Field
                    htmlFor={`${id}-status`}
                    label="Dars holati"
                >
                    <SelectField
                        id={`${id}-status`}
                        value={status}
                        onValueChange={(value) =>
                            setStatus(value as SessionStatus)
                        }
                        options={STATUS_OPTIONS}
                        disabled={saving}
                    />
                </Field>

                {error && <ErrorState message={error} />}

                {success && (
                    <SuccessNotice>{success}</SuccessNotice>
                )}

                <Button
                    type="button"
                    className="w-full"
                    disabled={saving}
                    onClick={() => void handleSave()}
                >
                    {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
            </CardContent>
        </Card>
    );
}

function JournalForClass({
    schoolId,
    academicYear,
    classId,
    date,
}: {
    schoolId: number;
    academicYear: string;
    classId: number;
    date: string;
}) {
    const [creatingId, setCreatingId] = useState<number | null>(
        null,
    );
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const params = new URLSearchParams({
        schoolId: String(schoolId),
        classId: String(classId),
        date,
    });

    const sessionsQuery = useApiQuery<LessonSession[]>(
        `/lesson-sessions?${params}`,
    );

    const scheduleParams = new URLSearchParams({
        schoolId: String(schoolId),
        classId: String(classId),
        academicYear,
        date,
    });

    const schedulesQuery = useApiQuery<LessonSchedule[]>(
        `/lesson-schedules?${scheduleParams}`,
    );

    const sessions = sessionsQuery.data ?? [];

    // GET /lesson-schedules?date haftalik jadvalning
    // aynan shu sanada amal qilgan versiyalarini beradi.
    const selectedDay = new Date(
        `${date}T00:00:00Z`,
    ).getUTCDay();

    const schedules = (schedulesQuery.data ?? []).filter(
        (lesson) => lesson.dayOfWeek === selectedDay,
    );

    const existingScheduleIds = new Set(
        sessions.map((session) => session.lessonScheduleId),
    );

    const missingSessions = schedules.filter(
        (schedule) => !existingScheduleIds.has(schedule.id),
    );

    async function createSession(lessonScheduleId: number) {
        if (creatingId !== null) return;

        setCreatingId(lessonScheduleId);
        setError('');
        setSuccess('');

        try {
            await authorizedPost('/lesson-sessions', {
                lessonScheduleId,
                lessonDate: date,
            });

            setSuccess('Dars sessiyasi yaratildi.');
            sessionsQuery.retry();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Dars sessiyasini yaratib bo‘lmadi.',
            );
        } finally {
            setCreatingId(null);
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">
                        {date} — Elektron jurnal
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Jurnal yozuvlari: {sessions.length}
                    </p>
                </div>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        sessionsQuery.retry();
                        schedulesQuery.retry();
                    }}
                >
                    <RefreshCw aria-hidden="true" />
                    Yangilash
                </Button>
            </div>

            {sessionsQuery.loading || schedulesQuery.loading ? (
                <LoadingState rows={4} />
            ) : (
                <>
                    {sessionsQuery.error && (
                        <ErrorState
                            message={sessionsQuery.error}
                            onRetry={sessionsQuery.retry}
                        />
                    )}

                    {schedulesQuery.error && (
                        <ErrorState
                            message={schedulesQuery.error}
                            onRetry={schedulesQuery.retry}
                        />
                    )}

                    {!sessionsQuery.error &&
                        !schedulesQuery.error &&
                        missingSessions.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Jurnalga kiritilmagan darslar
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    {missingSessions.map((schedule) => (
                                        <div
                                            key={schedule.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {schedule.lessonNumber}-dars —{' '}
                                                    {schedule.subject.nameUz}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {fullName(schedule.teacher)}
                                                </p>
                                            </div>

                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={creatingId !== null}
                                                onClick={() =>
                                                    void createSession(schedule.id)
                                                }
                                            >
                                                <Plus aria-hidden="true" />
                                                {creatingId === schedule.id
                                                    ? 'Yaratilmoqda...'
                                                    : 'Jurnalga qo‘shish'}
                                            </Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                    {error && <ErrorState message={error} />}

                    {success && (
                        <SuccessNotice>{success}</SuccessNotice>
                    )}

                    {!sessionsQuery.error && sessions.length > 0 ? (
                        <div className="grid gap-4 xl:grid-cols-2">
                            {sessions.map((session) => (
                                <SessionEditor
                                    key={session.id}
                                    session={session}
                                    onSaved={sessionsQuery.retry}
                                />
                            ))}
                        </div>
                    ) : (
                        !sessionsQuery.error &&
                        !schedulesQuery.error &&
                        missingSessions.length === 0 && (
                            <EmptyState
                                icon={BookOpenCheck}
                                title="Ushbu sana uchun jurnal bo‘sh"
                                description="Bu kunda rejalashtirilgan dars yoki jurnal yozuvi topilmadi."
                            />
                        )
                    )}
                </>
            )}
        </div>
    );
}

export function JournalPage() {
    const id = useId();

    const schoolsQuery = useApiQuery<School[]>('/schools');

    const [schoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(
        () => academicYearFor(todayInTashkent()),
    );
    const [classId, setClassId] = useState('');
    const [date, setDate] = useState(todayInTashkent);

    const classesQuery = useApiQuery<SchoolClass[]>(
        schoolId
            ? `/classes?schoolId=${schoolId}&academicYear=${academicYear}`
            : '/classes?schoolId=0&academicYear=2000-2001',
    );

    const classes = classesQuery.data ?? [];

    const yearStart = Number(academicYear.slice(0, 4));
    const yearMinDate = `${yearStart}-09-01`;
    const yearMaxDate = `${yearStart + 1}-08-31`;

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Professional ta’lim"
                title="Elektron jurnal"
                description="Dars mavzulari, uy vazifalari va dars holatini boshqarish"
            />

            <Card>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field
                        htmlFor={`${id}-school`}
                        label="Maktab"
                    >
                        <SelectField
                            id={`${id}-school`}
                            value={schoolId}
                            onValueChange={(value) => {
                                setSchoolId(value);
                                setClassId('');
                            }}
                            options={(schoolsQuery.data ?? []).map(
                                (school) => ({
                                    value: String(school.id),
                                    label: school.name,
                                }),
                            )}
                            placeholder="Maktabni tanlang"
                            disabled={schoolsQuery.loading}
                        />
                    </Field>

                    <Field
                        htmlFor={`${id}-year`}
                        label="O‘quv yili"
                    >
                        <SelectField
                            id={`${id}-year`}
                            value={academicYear}
                            onValueChange={(value) => {
                                setAcademicYear(value);
                                setClassId('');
                                const startYear = Number(value.slice(0, 4));
                                setDate(`${startYear}-09-01`);
                            }}
                            options={academicYearOptions(academicYear).map(
                                (year) => ({
                                    value: year,
                                    label: year,
                                }),
                            )}
                        />
                    </Field>

                    <Field
                        htmlFor={`${id}-class`}
                        label="Sinf"
                    >
                        <SelectField
                            id={`${id}-class`}
                            value={classId}
                            onValueChange={setClassId}
                            options={classes.map((item) => ({
                                value: String(item.id),
                                label: item.name,
                            }))}
                            placeholder="Sinfni tanlang"
                            disabled={
                                !schoolId ||
                                classesQuery.loading ||
                                Boolean(classesQuery.error)
                            }
                        />
                    </Field>

                    <Field
                        htmlFor={`${id}-date`}
                        label="Dars sanasi"
                    >
                        <Input
                            id={`${id}-date`}
                            type="date"
                            min={yearMinDate}
                            max={yearMaxDate}
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                        />
                    </Field>
                </CardContent>
            </Card>

            {schoolsQuery.error && (
                <ErrorState
                    message={schoolsQuery.error}
                    onRetry={schoolsQuery.retry}
                />
            )}

            {schoolId && classesQuery.error && (
                <ErrorState
                    message={classesQuery.error}
                    onRetry={classesQuery.retry}
                />
            )}

            {schoolId && classId && date &&
                date >= yearMinDate && date <= yearMaxDate ? (
                <JournalForClass
                    key={`${schoolId}-${classId}-${academicYear}-${date}`}
                    schoolId={Number(schoolId)}
                    classId={Number(classId)}
                    academicYear={academicYear}
                    date={date}
                />
            ) : (
                <EmptyState
                    icon={BookOpenCheck}
                    title="Elektron jurnalni tanlang"
                    description="Maktab, sinf va o‘quv yiliga mos sanani tanlang."
                />
            )}
        </div>
    );
}
