
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { CalendarDays, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPost } from '@/lib/auth-session';
import type { School } from '@/types/school';
import { CalendarSpecialDays } from '@/components/attendance/CalendarSpecialDays';
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

const DAYS = [
    'Dushanba',
    'Seshanba',
    'Chorshanba',
    'Payshanba',
    'Juma',
    'Shanba',
    'Yakshanba',
];

const inputStyle =
    'h-11 w-full rounded-xl border border-input ' +
    'bg-background px-3 text-sm';

function getAcademicYear() {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date());

    const year = Number(
        parts.find((part) => part.type === 'year')?.value,
    );

    const month = Number(
        parts.find((part) => part.type === 'month')?.value,
    );

    const start = month >= 9 ? year : year - 1;

    return `${start}-${start + 1}`;
}

function formatDays(mask: number) {
    return DAYS
        .filter((_, index) => (mask & (1 << index)) !== 0)
        .join(', ');
}

function WeeklySchedules({
    schoolId,
    academicYear,
}: {
    schoolId: number;
    academicYear: string;
}) {
    const path =
        `/attendance-calendar/weekly-schedules` +
        `?schoolId=${schoolId}&academicYear=${academicYear}`;

    const query = useApiQuery<WeeklySchedule[]>(path);

    const [membershipType, setMembershipType] =
        useState<MembershipType>('STUDENT');

    const [gradeFrom, setGradeFrom] = useState('1');
    const [gradeTo, setGradeTo] = useState('4');

    const [workingDaysMask, setWorkingDaysMask] =
        useState(31);

    const [effectiveFrom, setEffectiveFrom] = useState(
        `${academicYear.slice(0, 4)}-09-01`,
    );

    const [effectiveTo, setEffectiveTo] = useState(
        `${academicYear.slice(5)}-08-31`,
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const saving = useRef(false);

    function changeDay(index: number) {
        setWorkingDaysMask((previous) =>
            previous ^ (1 << index),
        );
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (saving.current) return;

        setError('');
        setSuccess('');

        if (workingDaysMask === 0) {
            setError('Kamida bitta ish kunini tanlang.');
            return;
        }

        if (
            effectiveTo &&
            effectiveTo < effectiveFrom
        ) {
            setError('Sana oralig‘i noto‘g‘ri.');
            return;
        }

        if (
            membershipType === 'STUDENT' &&
            Number(gradeFrom) > Number(gradeTo)
        ) {
            setError('Sinf oralig‘i noto‘g‘ri.');
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await authorizedPost(
                '/attendance-calendar/weekly-schedules',
                {
                    schoolId,
                    academicYear,
                    membershipType,
                    ...(membershipType === 'STUDENT'
                        ? {
                            gradeFrom: Number(gradeFrom),
                            gradeTo: Number(gradeTo),
                        }
                        : {}),
                    workingDaysMask,
                    effectiveFrom,
                    ...(effectiveTo
                        ? { effectiveTo }
                        : {}),
                },
            );

            setSuccess('Haftalik reja saqlandi.');
            query.retry();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Rejani saqlashda xatolik yuz berdi.',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-2xl border bg-card p-5"
            >
                <h2 className="text-lg font-semibold">
                    Haftalik o‘quv rejasini yaratish
                </h2>

                <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm font-medium">
                        Kimlar uchun?
                        <select
                            value={membershipType}
                            onChange={(event) =>
                                setMembershipType(
                                    event.target.value as MembershipType,
                                )
                            }
                            disabled={busy}
                            className={inputStyle}
                        >
                            <option value="STUDENT">
                                O‘quvchilar
                            </option>
                            <option value="TEACHER">
                                O‘qituvchilar
                            </option>
                        </select>
                    </label>

                    {membershipType === 'STUDENT' && (
                        <>
                            <label className="space-y-2 text-sm font-medium">
                                Qaysi sinfdan?
                                <select
                                    value={gradeFrom}
                                    onChange={(event) =>
                                        setGradeFrom(event.target.value)
                                    }
                                    disabled={busy}
                                    className={inputStyle}
                                >
                                    {Array.from(
                                        { length: 12 },
                                        (_, index) => index + 1,
                                    ).map((level) => (
                                        <option key={level} value={level}>
                                            {level}-sinf
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-2 text-sm font-medium">
                                Qaysi sinfgacha?
                                <select
                                    value={gradeTo}
                                    onChange={(event) =>
                                        setGradeTo(event.target.value)
                                    }
                                    disabled={busy}
                                    className={inputStyle}
                                >
                                    {Array.from(
                                        { length: 12 },
                                        (_, index) => index + 1,
                                    ).map((level) => (
                                        <option key={level} value={level}>
                                            {level}-sinf
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </>
                    )}
                </div>

                <div className="space-y-3">
                    <p className="text-sm font-semibold">
                        Haftaning ish kunlari
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {DAYS.map((day, index) => {
                            const checked =
                                (workingDaysMask & (1 << index)) !== 0;

                            return (
                                <label
                                    key={day}
                                    className={
                                        'flex cursor-pointer items-center gap-2 ' +
                                        'rounded-xl border px-3 py-2 text-sm ' +
                                        (checked
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border bg-background')
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={busy}
                                        onChange={() => changeDay(index)}
                                    />
                                    {day}
                                </label>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setWorkingDaysMask(31)}
                        >
                            5 kunlik
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setWorkingDaysMask(63)}
                        >
                            6 kunlik
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                        Boshlanish sanasi
                        <Input
                            type="date"
                            value={effectiveFrom}
                            min={`${academicYear.slice(0, 4)}-09-01`}
                            max={`${academicYear.slice(5)}-08-31`}
                            onChange={(event) =>
                                setEffectiveFrom(event.target.value)
                            }
                            disabled={busy}
                            required
                        />
                    </label>

                    <label className="space-y-2 text-sm font-medium">
                        Tugash sanasi
                        <Input
                            type="date"
                            value={effectiveTo}
                            min={effectiveFrom}
                            max={`${academicYear.slice(5)}-08-31`}
                            onChange={(event) =>
                                setEffectiveTo(event.target.value)
                            }
                            disabled={busy}
                        />
                    </label>
                </div>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {success && (
                    <p role="status" className="text-sm text-green-600">
                        {success}
                    </p>
                )}

                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda…' : 'Rejani saqlash'}
                </Button>
            </form>

            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                        Mavjud haftalik rejalar
                    </h2>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={query.retry}
                    >
                        <RefreshCw className="size-4" />
                        Yangilash
                    </Button>
                </div>

                {query.loading ? (
                    <p className="text-sm text-muted-foreground">
                        Rejalar yuklanmoqda…
                    </p>
                ) : query.error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {query.error}
                    </p>
                ) : query.data?.length ? (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">Kimlar uchun?</th>
                                    <th className="px-4 py-3">Sinflar</th>
                                    <th className="px-4 py-3">Ish kunlari</th>
                                    <th className="px-4 py-3">Amal qilish davri</th>
                                </tr>
                            </thead>
                            <tbody>
                                {query.data.map((schedule) => (
                                    <tr key={schedule.id} className="border-t">
                                        <td className="px-4 py-3">
                                            {schedule.membershipType === 'STUDENT'
                                                ? 'O‘quvchilar'
                                                : 'O‘qituvchilar'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {schedule.classId !== null
                                                ? `Sinf ID: ${schedule.classId}`
                                                : schedule.gradeFrom !== null &&
                                                    schedule.gradeTo !== null
                                                    ? `${schedule.gradeFrom}–${schedule.gradeTo}`
                                                    : 'Barcha'}
                                        </td>
                                        <td className="min-w-52 px-4 py-3">
                                            {formatDays(schedule.workingDaysMask)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {schedule.effectiveFrom}
                                            {' — '}
                                            {schedule.effectiveTo ?? 'Cheklanmagan'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                        Hozircha haftalik rejalar yaratilmagan.
                    </p>
                )}
            </section>
        </div>
    );
}

export function AttendanceCalendarPage() {
    const { session } = useAuth();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [activeTab, setActiveTab] =
        useState<'weekly' | 'special'>('weekly');
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [academicYear, setAcademicYear] =
        useState(getAcademicYear);

    const schoolId =
        selectedSchoolId ||
        (session?.profile.schoolId
            ? String(session.profile.schoolId)
            : '');

    const [start, end] = academicYear.split('-').map(Number);

    const validYear =
        /^\d{4}-\d{4}$/.test(academicYear) &&
        end === start + 1 &&
        start >= 2000 &&
        end <= 2100;

    const selectedSchool = (schoolsQuery.data ?? []).find(
        (school) => String(school.id) === schoolId,
    );

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Davomat boshqaruvi"
                title="O‘quv kalendari"
                description="Maktablarning haftalik o‘quv va ish kunlarini boshqarish."
                actions={<CalendarDays className="size-7 text-primary" />}
            />

            <div className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                    Maktab
                    <select
                        value={schoolId}
                        onChange={(event) =>
                            setSelectedSchoolId(event.target.value)
                        }
                        disabled={schoolsQuery.loading}
                        className={inputStyle}
                    >
                        <option value="">Maktabni tanlang</option>

                        {(schoolsQuery.data ?? []).map((school) => (
                            <option key={school.id} value={school.id}>
                                {school.name} — {school.district.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                    O‘quv yili
                    <Input
                        value={academicYear}
                        onChange={(event) =>
                            setAcademicYear(event.target.value)
                        }
                        placeholder="2026-2027"
                        maxLength={9}
                    />
                </label>
            </div>

            {schoolsQuery.error && (
                <p role="alert" className="text-sm text-destructive">
                    {schoolsQuery.error}
                </p>
            )}

            {!validYear && (
                <p className="text-sm text-destructive">
                    O‘quv yilini 2026-2027 shaklida kiriting.
                </p>
            )}


            {selectedSchool && validYear ? (
                <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant={activeTab === 'weekly' ? 'default' : 'outline'}
                            aria-pressed={activeTab === 'weekly'}
                            onClick={() => setActiveTab('weekly')}
                        >
                            Haftalik o‘quv rejasi
                        </Button>

                        <Button
                            type="button"
                            variant={activeTab === 'special' ? 'default' : 'outline'}
                            aria-pressed={activeTab === 'special'}
                            onClick={() => setActiveTab('special')}
                        >
                            Bayram va ta’tillar
                        </Button>
                    </div>

                    {activeTab === 'weekly' ? (
                        <WeeklySchedules
                            key={`${selectedSchool.id}-${academicYear}`}
                            schoolId={selectedSchool.id}
                            academicYear={academicYear}
                        />
                    ) : (
                        <CalendarSpecialDays
                            key={`${selectedSchool.id}-${academicYear}`}
                            school={selectedSchool}
                            academicYear={academicYear}
                        />
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Davom etish uchun maktab va o‘quv yilini tanlang.
                </p>
            )}

        </div>
    );
}
