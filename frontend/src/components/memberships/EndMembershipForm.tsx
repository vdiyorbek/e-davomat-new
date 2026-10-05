import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { endSchoolMembership } from '@/lib/school-memberships-api';

import type { SchoolMembership } from '@/types/school-membership';

interface EndMembershipFormProps {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

function nextDay(value: string): string {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

export function EndMembershipForm({
    membership,
    onSaved,
    onCancel,
}: EndMembershipFormProps) {
    const inputId = useId();
    const busyRef = useRef(false);

    const [endDate, setEndDate] = useState(
        membership.endDate ?? '',
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const personName = membership.person
        ? [
            membership.person.lastName,
            membership.person.firstName,
            membership.person.middleName,
        ].filter(Boolean).join(' ')
        : 'Shaxs ma’lumotlari mavjud emas';

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busyRef.current) return;

        setError('');

        if (!endDate || endDate <= membership.startDate) {
            setError(
                'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.',
            );
            return;
        }

        if (
            membership.endDate &&
            endDate > membership.endDate
        ) {
            setError(
                'Ushbu forma orqali faoliyat davrini uzaytirib bo‘lmaydi.',
            );
            return;
        }

        busyRef.current = true;
        setBusy(true);

        try {
            await endSchoolMembership(membership.id, endDate);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Tugash sanasini saqlab bo‘lmadi.',
            );
            return;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }

        onSaved();
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground sm:p-6"
        >
            <div>
                <h2 className="text-lg font-semibold">
                    Maktabga bog‘lanishni yakunlash
                </h2>

                <p className="mt-2 break-words font-medium">
                    {personName}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                    {membership.school.name}
                    {' · '}
                    {membership.type === 'STUDENT'
                        ? 'O‘quvchi'
                        : 'O‘qituvchi'}
                </p>
            </div>

            <div className="max-w-sm space-y-2">
                <label
                    htmlFor={inputId}
                    className="text-sm font-medium"
                >
                    Faol bo‘lmaydigan birinchi kun
                </label>

                <Input
                    id={inputId}
                    type="date"
                    required
                    min={nextDay(membership.startDate)}
                    max={membership.endDate ?? '9999-12-31'}
                    value={endDate}
                    disabled={busy}
                    onChange={(event) =>
                        setEndDate(event.target.value)
                    }
                />

                <p className="text-xs leading-5 text-muted-foreground">
                    Masalan, oxirgi faol kuni 30-sentyabr bo‘lsa,
                    1-oktyabrni tanlang. Shaxs ma’lumotlari va
                    davomat tarixi saqlanadi.
                </p>
            </div>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                >
                    Bekor qilish
                </Button>

                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda…' : 'Tugash sanasini saqlash'}
                </Button>
            </div>
        </form>
    );
}