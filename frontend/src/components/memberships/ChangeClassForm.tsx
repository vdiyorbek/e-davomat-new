import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolClassSelect } from './SchoolClassSelect';
import { changeMembershipClass } from '@/lib/school-memberships-api';
import type { SchoolMembership } from '@/types/school-membership';

function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
}

interface Props {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

export function ChangeClassForm({
    membership,
    onSaved,
    onCancel,
}: Props) {
    const id = useId();
    const saving = useRef(false);

    const [startDate, setStartDate] = useState(todayInTashkent);

    const [academicYear, setAcademicYear] = useState(() => {
        const today = todayInTashkent();
        const year = Number(today.slice(0, 4));
        const month = Number(today.slice(5, 7));
        const from = month >= 9 ? year : year - 1;

        return `${from}-${from + 1}`;
    });

    const [classId, setClassId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving.current) return;

        setError('');

        const [from, to] = academicYear.split('-').map(Number);

        if (
            !/^[1-9][0-9]{3}-[1-9][0-9]{3}$/.test(academicYear) ||
            to !== from + 1
        ) {
            setError('O‘quv yilini to‘g‘ri kiriting: 2026-2027.');
            return;
        }

        if (!classId) {
            setError('Yangi sinfni tanlang.');
            return;
        }

        if (Number(classId) === membership.classId) {
            setError('Boshqa sinfni tanlang.');
            return;
        }

        if (!startDate || startDate <= membership.startDate) {
            setError(
                'O‘tish sanasi eski biriktirish boshlanishidan keyin bo‘lsin.',
            );
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await changeMembershipClass(membership.id, {
                classId: Number(classId),
                startDate,
            });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Sinfni almashtirib bo‘lmadi.',
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
                {membership.school.name}
                {membership.schoolClass
                    ? ` — hozirgi sinf: ${membership.schoolClass.name}`
                    : ''}
            </p>

            <div className="space-y-2">
                <label
                    htmlFor={`${id}-year`}
                    className="text-sm font-medium"
                >
                    Yangi sinfning o‘quv yili
                </label>
                <Input
                    id={`${id}-year`}
                    value={academicYear}
                    onChange={(event) => {
                        setAcademicYear(event.target.value);
                        setClassId('');
                    }}
                    placeholder="2026-2027"
                    pattern="[1-9][0-9]{3}-[1-9][0-9]{3}"
                    maxLength={9}
                    required
                    disabled={busy}
                />
            </div>

            {/^[1-9][0-9]{3}-[1-9][0-9]{3}$/.test(academicYear) && (
                <SchoolClassSelect
                    key={`${membership.schoolId}-${academicYear}`}
                    schoolId={membership.schoolId}
                    academicYear={academicYear}
                    value={classId}
                    onChange={setClassId}
                    disabled={busy}
                />
            )}

            <div className="space-y-2">
                <label
                    htmlFor={`${id}-date`}
                    className="text-sm font-medium"
                >
                    Yangi sinfga o‘tish sanasi
                </label>
                <Input
                    id={`${id}-date`}
                    type="date"
                    min={membership.startDate}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                    disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                    Shu kundan eski biriktirish tugaydi.
                    Oldingi sinf tarixda saqlanadi.
                </p>
            </div>

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
                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda…' : 'Sinfni almashtirish'}
                </Button>
            </div>
        </form>
    );
}