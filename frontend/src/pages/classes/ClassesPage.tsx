import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import type { School } from '@/types/school';
import { PageHeader } from '@/components/common/PageHeader';

interface SchoolClass {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
}

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

    const saving = useRef(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving.current || !canCreate) return;

        const normalizedName = name.trim();

        setError('');
        setSuccess('');

        if (!normalizedName) {
            setError('Sinf nomini kiriting.');
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await authorizedPost<SchoolClass>('/classes', {
                schoolId,
                academicYear,
                name: normalizedName,
            });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Sinf yaratib bo‘lmadi.',
            );
            return;
        } finally {
            saving.current = false;
            setBusy(false);
        }

        setName('');
        setSuccess('Sinf yaratildi.');
        query.retry();
    }

    return (
        <div className="space-y-5">
            {canCreate && (
                <form
                    onSubmit={handleCreate}
                    className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
                >
                    <label className="block text-sm font-medium">
                        Yangi sinf nomi
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Masalan: 2A"
                            maxLength={30}
                            required
                            disabled={busy}
                            className="mt-2"
                        />
                    </label>

                    <Button type="submit" disabled={busy}>
                        {busy ? 'Saqlanmoqda…' : 'Sinf qo‘shish'}
                    </Button>

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p role="status" className="text-sm text-green-700 dark:text-green-400">
                            {success}
                        </p>
                    )}
                </form>
            )}

            {query.loading ? (
                <p role="status" className="text-sm text-muted-foreground">
                    Sinflar yuklanmoqda…
                </p>
            ) : query.error ? (
                <div className="space-y-3">
                    <p role="alert" className="text-sm text-destructive">
                        {query.error}
                    </p>
                    <Button variant="outline" onClick={query.retry}>
                        Qayta urinish
                    </Button>
                </div>
            ) : query.data?.length ? (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3">Sinf</th>
                                <th className="px-4 py-3">O‘quv yili</th>
                            </tr>
                        </thead>
                        <tbody>
                            {query.data.map((schoolClass) => (
                                <tr key={schoolClass.id} className="border-t">
                                    <td className="px-4 py-3 font-medium">
                                        {schoolClass.name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {schoolClass.academicYear}
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

            <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-2">
                <label className="block text-sm font-medium">
                    Maktab
                    <select
                        value={schoolId}
                        onChange={(event) => setSchoolId(event.target.value)}
                        disabled={
                            schoolsQuery.loading ||
                            Boolean(schoolsQuery.error) ||
                            !schools.length
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
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
                        onChange={(event) => setAcademicYear(event.target.value)}
                        placeholder="2026-2027"
                        maxLength={9}
                        className="mt-2"
                    />
                </label>
            </div>

            {schoolsQuery.error && (
                <div className="space-y-2">
                    <p role="alert" className="text-sm text-destructive">
                        {schoolsQuery.error}
                    </p>
                    <Button variant="outline" onClick={schoolsQuery.retry}>
                        Qayta urinish
                    </Button>
                </div>
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
                    O‘quv yilini ketma-ket kiriting: 2026-2027.
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