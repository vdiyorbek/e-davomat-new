import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { transferSchoolMembership } from '@/lib/school-memberships-api';
import { SchoolClassSelect } from './SchoolClassSelect';

import type { School } from '@/types/school';
import type { SchoolMembership } from '@/types/school-membership';

interface Props {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

export function TransferSchoolForm({
    membership,
    onSaved,
    onCancel,
}: Props) {
    const saving = useRef(false);

    const [schoolId, setSchoolId] = useState('');
    const [classId, setClassId] = useState('');
    const [academicYear, setAcademicYear] = useState(
        membership.schoolClass?.academicYear ?? '',
    );
    const [startDate, setStartDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const schoolsQuery = useApiQuery<School[]>('/schools');

    const schools = (schoolsQuery.data ?? []).filter(
        (school) => school.id !== membership.schoolId,
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving.current) return;

        setError('');

        const selectedSchool = schools.find(
            (school) => String(school.id) === schoolId,
        );

        if (
            schoolsQuery.loading ||
            schoolsQuery.error ||
            !selectedSchool
        ) {
            setError('Ro‘yxatdan yangi maktabni tanlang.');
            return;
        }

        const [from, to] = academicYear.split('-').map(Number);

        if (
            !/^[1-9][0-9]{3}-[1-9][0-9]{3}$/.test(academicYear) ||
            to !== from + 1
        ) {
            setError('O‘quv yilini to‘g‘ri kiriting: 2026-2027.');
            return;
        }

        if (!classId) {
            setError('Yangi maktabdagi sinfni tanlang.');
            return;
        }

        if (!startDate || startDate <= membership.startDate) {
            setError(
                'Ko‘chirish sanasi eski biriktirish boshlanishidan keyin bo‘lsin.',
            );
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await transferSchoolMembership(membership.id, {
                schoolId: selectedSchool.id,
                classId: Number(classId),
                startDate,
            });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Boshqa maktabga ko‘chirib bo‘lmadi.',
            );
            return;
        } finally {
            saving.current = false;
            setBusy(false);
        }

        onSaved();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm font-medium">
                Hozirgi maktab: {membership.school.name}
            </p>

            <fieldset disabled={busy} className="space-y-4">
                <label className="block text-sm font-medium">
                    Yangi maktab
                    <select
                        value={schoolId}
                        onChange={(event) => {
                            setSchoolId(event.target.value);
                            setClassId('');
                        }}
                        required
                        disabled={
                            schoolsQuery.loading ||
                            Boolean(schoolsQuery.error) ||
                            schools.length === 0
                        }
                        className="mt-2 h-12 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
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

                {schoolsQuery.error && (
                    <div className="space-y-2">
                        <p role="alert" className="text-sm text-destructive">
                            {schoolsQuery.error}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={schoolsQuery.retry}
                        >
                            Qayta urinish
                        </Button>
                    </div>
                )}

                {!schoolsQuery.loading &&
                    !schoolsQuery.error &&
                    schools.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Ko‘chirish uchun boshqa maktab topilmadi.
                        </p>
                    )}

                <label className="block text-sm font-medium">
                    O‘quv yili
                    <Input
                        value={academicYear}
                        onChange={(event) => {
                            setAcademicYear(event.target.value);
                            setClassId('');
                        }}
                        placeholder="2026-2027"
                        pattern="[1-9][0-9]{3}-[1-9][0-9]{3}"
                        maxLength={9}
                        required
                        className="mt-2"
                    />
                </label>

                {schoolId &&
                    /^[1-9][0-9]{3}-[1-9][0-9]{3}$/.test(academicYear) && (
                        <SchoolClassSelect
                            key={`${schoolId}-${academicYear}`}
                            schoolId={Number(schoolId)}
                            academicYear={academicYear}
                            value={classId}
                            onChange={setClassId}
                            disabled={busy}
                        />
                    )}

                <label className="block text-sm font-medium">
                    Yangi maktabda o‘qish boshlanadigan sana
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(event) =>
                            setStartDate(event.target.value)
                        }
                        min={membership.startDate}
                        required
                        className="mt-2"
                    />
                </label>

                <p className="text-xs text-muted-foreground">
                    Shu kundan eski maktabdagi biriktirish tugaydi.
                    Oldingi maktab va sinf tarixda saqlanadi.
                </p>
            </fieldset>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                >
                    Bekor qilish
                </Button>

                <Button
                    type="submit"
                    disabled={
                        busy ||
                        schoolsQuery.loading ||
                        Boolean(schoolsQuery.error) ||
                        !schoolId ||
                        !classId
                    }
                >
                    {busy ? 'Saqlanmoqda…' : 'Maktabga ko‘chirish'}
                </Button>
            </div>
        </form>
    );
}