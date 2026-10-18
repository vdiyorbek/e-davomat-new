import { useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpenCheck, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
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
    person: {
        id: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
    };
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
    teacher: {
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
    };
    class: {
        id: number;
        name: string;
        gradeLevel: number | null;
    };
    subject: {
        id: number;
        code: string;
        nameUz: string;
    };
    startDate: string;
    endDate: string | null;
}

const fieldStyle =
    'mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

function tashkentToday(): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Tashkent',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).formatToParts(new Date());
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function currentAcademicYear(): string {
    const today = tashkentToday();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

function isValidAcademicYear(value: string): boolean {
    const matched = /^(\d{4})-(\d{4})$/.exec(value);
    return Boolean(
        matched &&
        Number(matched[2]) === Number(matched[1]) + 1 &&
        Number(matched[1]) >= 2000 &&
        Number(matched[2]) <= 2100,
    );
}

function personName(person: {
    firstName: string;
    lastName: string;
    middleName: string | null;
}) {
    return [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' ');
}

function AssignmentsForSchool({
    schoolId,
    academicYear,
}: {
    schoolId: number;
    academicYear: string;
}) {
    const classesQuery = useApiQuery<SchoolClass[]>(
        `/classes?schoolId=${schoolId}&academicYear=${academicYear}`,
    );
    const subjectsQuery = useApiQuery<Subject[]>('/subjects');
    const assignmentsQuery = useApiQuery<TeacherAssignment[]>(
        `/teacher-assignments?schoolId=${schoolId}&academicYear=${academicYear}`,
    );

    const [searchText, setSearchText] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [teacherPage, setTeacherPage] = useState(1);
    const [teacherMembershipId, setTeacherMembershipId] = useState('');
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [startDate, setStartDate] = useState(tashkentToday);
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

    const teachersQuery = useApiQuery<MembershipPage>(
        `/school-memberships?${teacherParams.toString()}`,
    );
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

    function changeTeacherPage(next: number) {
        setTeacherMembershipId('');
        setTeacherPage(next);
    }

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        setSuccess('');

        if (!teacherMembershipId || !classId || !subjectId || !startDate) {
            setError('O‘qituvchi, sinf, fan va boshlanish sanasini belgilang.');
            return;
        }

        if (endDate && endDate <= startDate) {
            setError('Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.');
            return;
        }

        setBusy(true);
        try {
            await authorizedPost('/teacher-assignments', {
                teacherMembershipId: Number(teacherMembershipId),
                classId: Number(classId),
                subjectId: Number(subjectId),
                startDate,
                ...(endDate ? { endDate } : {}),
            });
            setSuccess('O‘qituvchi fan va sinfga muvaffaqiyatli biriktirildi.');
            assignmentsQuery.retry();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error ? caught.message : 'Biriktirishni saqlab bo‘lmadi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold">O‘qituvchini fan va sinfga biriktirish</h2>
                <form onSubmit={applyTeacherSearch} className="flex flex-wrap items-end gap-3">
                    <label className="min-w-56 flex-1 text-sm font-medium">
                        O‘qituvchini izlash
                        <Input
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            maxLength={100}
                            placeholder="Ism yoki familiya"
                            className="mt-2"
                        />
                    </label>
                    <Button type="submit" variant="outline">Qidirish</Button>
                </form>

                <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="text-sm font-medium">
                            O‘qituvchi
                            <select
                                className={fieldStyle}
                                value={teacherMembershipId}
                                onChange={(event) => setTeacherMembershipId(event.target.value)}
                                disabled={busy || teachersQuery.loading || Boolean(teachersQuery.error)}
                                required
                            >
                                <option value="">O‘qituvchini tanlang</option>
                                {teachers.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {personName(item.person)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="text-sm font-medium">
                            Sinf
                            <select
                                className={fieldStyle}
                                value={classId}
                                onChange={(event) => setClassId(event.target.value)}
                                disabled={busy || classesQuery.loading || Boolean(classesQuery.error)}
                                required
                            >
                                <option value="">Sinfni tanlang</option>
                                {classes.map((item) => (
                                    <option value={item.id} key={item.id}>
                                        {item.name}{item.gradeLevel ? ` (${item.gradeLevel}-sinf)` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="text-sm font-medium">
                            Fan
                            <select
                                className={fieldStyle}
                                value={subjectId}
                                onChange={(event) => setSubjectId(event.target.value)}
                                disabled={busy || subjectsQuery.loading || Boolean(subjectsQuery.error)}
                                required
                            >
                                <option value="">Fanni tanlang</option>
                                {subjects.map((item) => (
                                    <option value={item.id} key={item.id}>{item.nameUz}</option>
                                ))}
                            </select>
                        </label>

                        <label className="text-sm font-medium">
                            Boshlanish sanasi
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                disabled={busy}
                                className="mt-2"
                                required
                            />
                        </label>

                        <label className="text-sm font-medium">
                            Tugash sanasi (ixtiyoriy)
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                disabled={busy}
                                className="mt-2"
                            />
                        </label>
                    </div>

                    {teachersQuery.error && <p role="alert" className="text-sm text-destructive">O‘qituvchilar: {teachersQuery.error}</p>}
                    {classesQuery.error && <p role="alert" className="text-sm text-destructive">Sinflar: {classesQuery.error}</p>}
                    {subjectsQuery.error && <p role="alert" className="text-sm text-destructive">Fanlar: {subjectsQuery.error}</p>}

                    {!teachersQuery.loading && !teachersQuery.error && teachers.length === 0 && (
                        <p className="text-sm text-muted-foreground">Bu maktabda izlovga mos faol o‘qituvchi topilmadi.</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="submit"
                            disabled={busy || !teacherMembershipId || !classId || !subjectId || !startDate ||
                                classesQuery.loading || subjectsQuery.loading || teachersQuery.loading}
                        >
                            {busy ? 'Saqlanmoqda…' : 'Biriktirish'}
                        </Button>
                        {teachersQuery.data && teachersQuery.data.totalPages > 1 && (
                            <div className="flex items-center gap-2 text-sm">
                                <Button
                                    type="button" variant="outline" size="sm"
                                    disabled={teacherPage <= 1 || teachersQuery.loading}
                                    onClick={() => changeTeacherPage(teacherPage - 1)}
                                >Oldingi</Button>
                                <span>{teacherPage} / {teachersQuery.data.totalPages}</span>
                                <Button
                                    type="button" variant="outline" size="sm"
                                    disabled={teacherPage >= teachersQuery.data.totalPages || teachersQuery.loading}
                                    onClick={() => changeTeacherPage(teacherPage + 1)}
                                >Keyingi</Button>
                            </div>
                        )}
                    </div>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    {success && <p role="status" className="text-sm text-green-600">{success}</p>}
                </form>
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">Mavjud biriktirishlar</h2>
                        <p className="text-sm text-muted-foreground">Jami: {assignments.length}</p>
                    </div>
                    <Button
                        type="button" variant="outline" size="sm"
                        onClick={assignmentsQuery.retry}
                        disabled={assignmentsQuery.loading}
                    >
                        <RefreshCw aria-hidden="true" /> Yangilash
                    </Button>
                </div>
                {assignmentsQuery.loading ? (
                    <p className="text-sm text-muted-foreground">Biriktirishlar yuklanmoqda…</p>
                ) : assignmentsQuery.error ? (
                    <p role="alert" className="text-sm text-destructive">{assignmentsQuery.error}</p>
                ) : assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Hozircha biriktirish mavjud emas.</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">O‘qituvchi</th>
                                    <th className="px-4 py-3">Sinf</th>
                                    <th className="px-4 py-3">Fan</th>
                                    <th className="px-4 py-3">Boshlanishi</th>
                                    <th className="px-4 py-3">Tugashi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignments.map((item) => (
                                    <tr key={item.id} className="border-t border-border">
                                        <td className="px-4 py-3 font-medium">{personName(item.teacher)}</td>
                                        <td className="px-4 py-3">{item.class.name}</td>
                                        <td className="px-4 py-3">{item.subject.nameUz}</td>
                                        <td className="px-4 py-3 tabular-nums">{item.startDate}</td>
                                        <td className="px-4 py-3 tabular-nums">{item.endDate ?? 'Davom etmoqda'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export function TeacherAssignmentsPage() {
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [schoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(currentAcademicYear);
    const schools = schoolsQuery.data ?? [];
    const validYear = isValidAcademicYear(academicYear);
    const school = schools.find((item) => String(item.id) === schoolId);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Elektron ta’lim"
                title="O‘qituvchi — fan — sinf"
                description="O‘qituvchilarga o‘quv yili bo‘yicha fan va sinflarni biriktirish."
                actions={<BookOpenCheck className="size-7 text-primary" />}
            />
            <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
                <label className="text-sm font-medium">
                    Maktab
                    <select
                        className={fieldStyle}
                        value={schoolId}
                        onChange={(event) => setSchoolId(event.target.value)}
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error)}
                    >
                        <option value="">Maktabni tanlang</option>
                        {schools.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} — {item.district.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="text-sm font-medium">
                    O‘quv yili
                    <Input
                        className="mt-2"
                        value={academicYear}
                        onChange={(event) => setAcademicYear(event.target.value)}
                        placeholder="2026-2027"
                        maxLength={9}
                    />
                </label>
            </div>
            {schoolsQuery.error && <p role="alert" className="text-sm text-destructive">{schoolsQuery.error}</p>}
            {!validYear && <p role="alert" className="text-sm text-destructive">O‘quv yilini 2026-2027 shaklida kiriting.</p>}
            {school && validYear && (
                <AssignmentsForSchool
                    key={`${school.id}-${academicYear}`}
                    schoolId={school.id}
                    academicYear={academicYear}
                />
            )}
        </div>
    );
}
