
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';
import type { DailyAttendance } from '@/types/daily-attendance';

type ExcuseReason =
    | 'ILLNESS'
    | 'OLYMPIAD'
    | 'FAMILY'
    | 'OTHER';

interface Props {
    item: DailyAttendance;
    onSaved: () => void;
    onCancel: () => void;
}

interface CreatedExcuse {
    id: number;
    status: 'ACTIVE';
}

const MAX_PDF_SIZE = 5 * 1024 * 1024;

export function AttendanceExcuseForm({
    item,
    onSaved,
    onCancel,
}: Props) {
    const id = useId();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const name = item.person
        ? [
            item.person.lastName,
            item.person.firstName,
            item.person.middleName,
        ].filter(Boolean).join(' ')
        : 'Noma’lum o‘quvchi';

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (saving || !item.person) return;

        const form = new FormData(event.currentTarget);

        const reason = String(form.get('reason') ?? '');
        const reasonNote = String(
            form.get('reasonNote') ?? '',
        ).trim();

        const startDate = String(form.get('startDate') ?? '');
        const endDate = String(form.get('endDate') ?? '');

        const file = form.get('file');

        setError('');

        if (!['ILLNESS', 'OLYMPIAD', 'FAMILY', 'OTHER'].includes(reason)) {
            setError('Sabab turini tanlang.');
            return;
        }

        if (!startDate || !endDate || endDate < startDate) {
            setError('Sana oralig‘ini to‘g‘ri kiriting.');
            return;
        }

        if (reasonNote.length > 500) {
            setError('Izoh 500 ta belgidan oshmasligi kerak.');
            return;
        }

        if (!(file instanceof File) || file.size === 0) {
            setError('Asoslovchi PDF arizani tanlang.');
            return;
        }

        if (file.size > MAX_PDF_SIZE) {
            setError('PDF hajmi 5 MB dan oshmasligi kerak.');
            return;
        }

        if (
            !file.name.toLowerCase().endsWith('.pdf') ||
            (file.type !== '' && file.type !== 'application/pdf')
        ) {
            setError('Faqat PDF formatidagi hujjatni yuklang.');
            return;
        }

        const payload = new FormData();

        payload.append('personId', String(item.person.id));
        payload.append('schoolId', String(item.schoolId));
        payload.append('reason', reason as ExcuseReason);
        payload.append('startDate', startDate);
        payload.append('endDate', endDate);

        if (reasonNote) {
            payload.append('reasonNote', reasonNote);
        }

        payload.append('file', file);

        setSaving(true);

        try {
            await authorizedPost<CreatedExcuse>(
                '/attendance-excuses',
                payload,
            );

            onSaved();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Arizani saqlashda xatolik yuz berdi.',
            );
        } finally {
            setSaving(false);
        }
    }

    const inputClass =
        'h-11 w-full rounded-xl border border-input ' +
        'bg-background px-3 text-sm outline-none ' +
        'focus-visible:ring-2 focus-visible:ring-ring';

    return (
        <form onSubmit={(event) => void handleSubmit(event)}
            className="space-y-5"
        >
            <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">
                    Tanlangan o‘quvchi
                </p>
                <p className="mt-1 font-semibold">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {item.school.name}
                    {item.className ? ` · ${item.className}` : ''}
                </p>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor={`${id}-reason`}
                    className="text-sm font-semibold"
                >
                    Sabab turi *
                </label>

                <select
                    id={`${id}-reason`}
                    name="reason"
                    required
                    defaultValue=""
                    disabled={saving}
                    className={inputClass}
                >
                    <option value="" disabled>
                        Sabab turini tanlang
                    </option>
                    <option value="ILLNESS">Kasallik</option>
                    <option value="OLYMPIAD">Olimpiada</option>
                    <option value="FAMILY">Oilaviy sabab</option>
                    <option value="OTHER">Boshqa sabab</option>
                </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label
                        htmlFor={`${id}-start`}
                        className="text-sm font-semibold"
                    >
                        Boshlanish sanasi *
                    </label>

                    <Input
                        id={`${id}-start`}
                        name="startDate"
                        type="date"
                        required
                        defaultValue={item.date}
                        disabled={saving}
                    />
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor={`${id}-end`}
                        className="text-sm font-semibold"
                    >
                        Tugash sanasi *
                    </label>

                    <Input
                        id={`${id}-end`}
                        name="endDate"
                        type="date"
                        required
                        defaultValue={item.date}
                        disabled={saving}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor={`${id}-note`}
                    className="text-sm font-semibold"
                >
                    Izoh (ixtiyoriy)
                </label>

                <textarea
                    id={`${id}-note`}
                    name="reasonNote"
                    maxLength={500}
                    rows={3}
                    disabled={saving}
                    placeholder="Qisqacha izoh"
                    className={[
                        'w-full resize-y rounded-xl border border-input',
                        'bg-background px-3 py-2 text-sm outline-none',
                        'focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                />

                <p className="text-xs text-muted-foreground">
                    Shaxsiy yoki tibbiy tafsilotlarni ortiqcha yozmang.
                </p>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor={`${id}-file`}
                    className="text-sm font-semibold"
                >
                    Asoslovchi ariza (PDF) *
                </label>

                <input
                    id={`${id}-file`}
                    name="file"
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                    disabled={saving}
                    className="block w-full rounded-xl border border-input bg-background p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5"
                />

                <p className="text-xs text-muted-foreground">
                    PDF formatida, maksimal 5 MB.
                </p>
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {error}
                </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={onCancel}
                >
                    Bekor qilish
                </Button>

                <Button type="submit" disabled={saving}>
                    {saving ? 'Saqlanmoqda...' : 'Sababli qilib saqlash'}
                </Button>
            </div>
        </form>
    );
}
