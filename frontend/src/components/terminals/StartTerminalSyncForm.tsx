import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';

interface Props {
    terminalId: number;
    isActive: boolean;
    onStarted: () => void;
}

interface StartSyncResponse {
    terminalId: number;
    syncStartAt: string;
    eventsSyncedUntil: string | null;
    message: string;
}

function getTodayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
}

export function StartTerminalSyncForm({
    terminalId,
    isActive,
    onStarted,
}: Props) {
    const inputId = useId();

    const [startDate, setStartDate] = useState(getTodayInTashkent);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (submitting || !isActive) return;

        setError('');

        if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate)) {
            setError('Boshlanish sanasini to‘g‘ri kiriting.');
            return;
        }

        const startTime = `${startDate}T00:00:00+05:00`;
        const timestamp = Date.parse(startTime);

        if (!Number.isFinite(timestamp) || timestamp > Date.now()) {
            setError('Kelajakdagi sanani tanlab bo‘lmaydi.');
            return;
        }

        // Masalan, mavjud bo‘lmagan 31-fevral sanasini rad etadi.
        const normalizedDate = new Date(timestamp + 5 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        if (normalizedDate !== startDate) {
            setError('Bunday sana mavjud emas.');
            return;
        }

        setSubmitting(true);

        try {
            await authorizedPost<StartSyncResponse>(
                `/terminals/${terminalId}/sync/start`,
                { startTime },
            );
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Sinxronlashni boshlab bo‘lmadi.',
            );
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
        onStarted();
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-xl border bg-muted/30 p-3"
            aria-busy={submitting}
        >
            <div className="space-y-2">
                <label htmlFor={inputId} className="text-sm font-medium">
                    Qaysi sanadan olinsin?
                </label>

                <input
                    id={inputId}
                    type="date"
                    required
                    min="2000-01-01"
                    max={getTodayInTashkent()}
                    value={startDate}
                    disabled={submitting || !isActive}
                    onChange={(event) => {
                        setStartDate(event.target.value);
                        setError('');
                    }}
                    className="block min-w-0 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />

                <p className="text-xs text-muted-foreground">
                    Tanlangan kunning Toshkent vaqti bilan 00:00 dan
                    boshlab eventlar olinadi. Keyin avtomatik davom etadi.
                </p>
            </div>

            {!isActive && (
                <p className="text-xs text-muted-foreground">
                    Sinxronlashni boshlash uchun terminal faol bo‘lishi kerak.
                </p>
            )}

            {error && (
                <p role="alert" className="break-words text-sm text-destructive">
                    {error}
                </p>
            )}

            <Button
                type="submit"
                className="w-full whitespace-normal"
                disabled={submitting || !isActive}
            >
                {submitting
                    ? 'Saqlanmoqda…'
                    : 'Sinxronlashni boshlash'}
            </Button>
        </form>
    );
}