
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';

import {
    authorizedPost,
    authorizedPatch,
} from '@/lib/auth-session';

import type { School } from '@/types/school';

interface SchoolClass {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
    gradeLevel: number | null;
}

const GRADES = Array.from(
    { length: 12 },
    (_, index) => index + 1,
);

const selectStyle =
    'mt-2 h-11 w-full rounded-xl border border-input ' +
    'bg-background px-3 text-sm disabled:opacity-50';

function currentAcademicYear(): string {
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

    const from = month >= 9 ? year : year - 1;

    return `${from}-${from + 1}`;
}

function GradeLevelEditor({
    schoolClass,
    onSaved,
}: {
    schoolClass: SchoolClass;
    onSaved: () => void;
}) {
    const [gradeLevel, setGradeLevel] = useState(
        schoolClass.gradeLevel == null
            ? ''
            : String(schoolClass.gradeLevel),
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const saving = useRef(false);

    const unchanged =
        gradeLevel !== '' &&
        Number(gradeLevel) === schoolClass.gradeLevel;

    async function handleSave() {
        if (saving.current || !gradeLevel || unchanged) {
            return;
        }

        saving.current = true;
        setBusy(true);
        setError('');
        setSuccess('');

        try {
            await authorizedPatch(
                `/classes/${schoolClass.id}/grade-level`,
                {
                    gradeLevel: Number(gradeLevel),
                },
            );

            setSuccess('Saqlandi');
            onSaved();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Sinf darajasini saqlab bo‘lmadi.',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <select
                    aria-label={`${schoolClass.name} darajasi`}
                    value={gradeLevel}
                    disabled={busy}
                    onChange={(event) => {
                        setGradeLevel(event.target.value);
                        setError('');
                        setSuccess('');
                    }}
                    className={
                        'h-9 min-w-28 rounded-lg border border-input ' +
                        'bg-background px-2 text-sm'
                    }
                >
                    <option value="">Belgilanmagan</option>

                    {GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                            {grade}-sinf
                        </option>
                    ))}
                </select>

                <Button
                    type="button"
                    size="sm"
                    disabled={busy || !gradeLevel || unchanged}
                    onClick={() => void handleSave()}
                >
                    {busy ? '...' : 'Saqlash'}
                </Button>
            </div>

            {schoolClass.gradeLevel == null && !success && (
                <p className="text-xs text-amber-600">
                    Daraja belgilanmagan
                </p>
            )}

            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}

            {success && (
                <p role="status" className="text-xs text-green-600">
                    {success}
                </p>
            )}
        </div>
    );
}

function ClassesList({
    schoolId,
    academicYear,
    canCreate,
}: {
    schoolId: number;
    academicYear: string;
    canCreate: boolean;
}) {
    const query = useApiQuery<SchoolClass[]>(
        `/classes?schoolId=${schoolId}&academicYear=${academicYear}`,
    );

    const [name, setName] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const saving = useRef(false);

    async function handleCreate(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (saving.current || !canCreate) return;

        const normalizedName = name.trim();

        setError('');
        setSuccess('');

        if (!normalizedName || !gradeLevel) {
            setError('Sinf nomi va darajasini kiriting.');
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await authorizedPost<SchoolClass>('/classes', {
                schoolId,
                academicYear,
                name: normalizedName,
                gradeLevel: Number(gradeLevel),
            });

            setName('');
            setGradeLevel('');
            setSuccess('Sinf muvaffaqiyatli yaratildi.');

            query.retry();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Sinf yaratib bo‘lmadi.',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    const classes = query.data ?? [];

    const missingGradeCount = classes.filter(
        (item) => item.gradeLevel == null,
    ).length;

    return (
        <div className="space-y-5">
            {canCreate && (
                <form
                    onSubmit={handleCreate}
                    className="space-y-4 rounded-2xl border border-border bg-card p-5"
                >
                    <h2 className="text-lg font-semibold">
                        Yangi sinf qo‘shish
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium">
                            Sinf nomi

                            <Input
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="Masalan: 2A"
                                maxLength={30}
                                required
                                disabled={busy}
                                className="mt-2"
                            />
                        </label>

                        <label className="block text-sm font-medium">
                            Sinf darajasi

                            <select
                                value={gradeLevel}
                                onChange={(event) =>
                                    setGradeLevel(event.target.value)
                                }
                                required
                                disabled={busy}
                                className={selectStyle}
                            >
                                <option value="">
                                    Darajani tanlang
                                </option>

                                {GRADES.map((grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}-sinf
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <Button type="submit" disabled={busy}>
                        {busy ? 'Saqlanmoqda…' : 'Sinf qo‘shish'}
                    </Button>

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
                </form>
            )}

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                        Mavjud sinflar
                    </h2>

                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>Jami: {classes.length}</span>

                        {!query.loading && missingGradeCount > 0 && (
                            <span className="text-amber-600">
                                Darajasi belgilanmagan: {missingGradeCount}
                            </span>
                        )}
                    </div>
                </div>

                {query.loading ? (
                    <p className="text-sm text-muted-foreground">
                        Sinflar yuklanmoqda…
                    </p>
                ) : query.error ? (
                    <div className="space-y-3">
                        <p role="alert" className="text-sm text-destructive">
                            {query.error}
                        </p>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={query.retry}
                        >
                            Qayta urinish
                        </Button>
                    </div>
                ) : classes.length ? (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">
                                        Sinf
                                    </th>
                                    <th className="px-4 py-3">
                                        O‘quv yili
                                    </th>
                                    <th className="px-4 py-3">
                                        Sinf darajasi
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {classes.map((schoolClass) => (
                                    <tr
                                        key={schoolClass.id}
                                        className="border-t"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {schoolClass.name}
                                        </td>

                                        <td className="px-4 py-3">
                                            {schoolClass.academicYear}
                                        </td>

                                        <td className="px-4 py-3">
                                            {canCreate ? (
                                                <GradeLevelEditor
                                                    key={`${schoolClass.id}-${schoolClass.gradeLevel ?? 'none'}`}
                                                    schoolClass={schoolClass}
                                                    onSaved={query.retry}
                                                />
                                            ) : (
                                                schoolClass.gradeLevel == null
                                                    ? 'Belgilanmagan'
                                                    : `${schoolClass.gradeLevel}-sinf`
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Ushbu o‘quv yilida sinflar mavjud emas.
                    </p>
                )}
            </section>
        </div>
    );
}

export function ClassesPage() {
    const { session } = useAuth();

    const role = session?.profile.role;

    const canCreate =
        role === 'SUPER_ADMIN' ||
        role === 'REGION_ADMIN' ||
        role === 'DISTRICT_ADMIN' ||
        role === 'SCHOOL_ADMIN';

    const schoolsQuery = useApiQuery<School[]>('/schools');

    const [schoolId, setSchoolId] = useState('');

    const [academicYear, setAcademicYear] =
        useState(currentAcademicYear);

    const schools = schoolsQuery.data ?? [];

    const selectedSchool = schools.find(
        (school) => String(school.id) === schoolId,
    );

    const [from, to] = academicYear.split('-').map(Number);

    const validYear =
        /^[1-9][0-9]{3}-[1-9][0-9]{3}$/.test(academicYear) &&
        to === from + 1;

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Boshqaruv"
                title="Sinflar"
                description="Maktab va o‘quv yili bo‘yicha sinflarni boshqarish."
            />

            <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
                <label className="block text-sm font-medium">
                    Maktab

                    <select
                        value={schoolId}
                        onChange={(event) =>
                            setSchoolId(event.target.value)
                        }
                        disabled={
                            schoolsQuery.loading ||
                            Boolean(schoolsQuery.error) ||
                            schools.length === 0
                        }
                        className={selectStyle}
                    >
                        <option value="">
                            {schoolsQuery.loading
                                ? 'Yuklanmoqda…'
                                : 'Maktabni tanlang'}
                        </option>

                        {schools.map((school) => (
                            <option key={school.id} value={school.id}>
                                {school.name} — {school.district.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-sm font-medium">
                    O‘quv yili

                    <Input
                        value={academicYear}
                        onChange={(event) =>
                            setAcademicYear(event.target.value)
                        }
                        placeholder="2026-2027"
                        maxLength={9}
                        className="mt-2"
                    />
                </label>
            </div>

            {schoolsQuery.error && (
                <p role="alert" className="text-sm text-destructive">
                    {schoolsQuery.error}
                </p>
            )}

            {!schoolsQuery.loading &&
                !schoolsQuery.error &&
                schools.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Sizga ko‘rinadigan maktablar mavjud emas.
                    </p>
                )}

            {!validYear && (
                <p className="text-sm text-destructive">
                    O‘quv yilini 2026-2027 shaklida kiriting.
                </p>
            )}

            {!schoolsQuery.loading &&
                !schoolsQuery.error &&
                selectedSchool &&
                validYear && (
                    <ClassesList
                        key={`${schoolId}-${academicYear}`}
                        schoolId={selectedSchool.id}
                        academicYear={academicYear}
                        canCreate={canCreate}
                    />
                )}
        </div>
    );
}
