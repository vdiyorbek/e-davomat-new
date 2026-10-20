import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';
import { todayInTashkent } from '@/lib/date';

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

export function StartTerminalSyncForm({ terminalId, isActive, onStarted }: Props) {
    const { t } = useTranslation();
    const inputId = useId();
    const [startDate, setStartDate] = useState(todayInTashkent);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting || !isActive) return;
        setError('');

        if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate)) return setError(t('terminals.sync.errors.date'));

        const startTime = `${startDate}T00:00:00+05:00`;
        const timestamp = Date.parse(startTime);
        if (!Number.isFinite(timestamp) || timestamp > Date.now()) return setError(t('terminals.sync.errors.future'));

        // Masalan, mavjud bo‘lmagan 31-fevral sanasini rad etadi.
        const normalizedDate = new Date(timestamp + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (normalizedDate !== startDate) return setError(t('terminals.sync.errors.invalid'));

        setSubmitting(true);
        try {
            await authorizedPost<StartSyncResponse>(`/terminals/${terminalId}/sync/start`, { startTime });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.sync.errors.failed'));
            setSubmitting(false);
            return;
        }
        setSubmitting(false);
        onStarted();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-muted/30 p-3" aria-busy={submitting}>
            <Field
                htmlFor={inputId}
                label={t('terminals.sync.fromDate')}
                hint={isActive ? t('terminals.sync.hint') : t('terminals.sync.inactive')}
                error={error || undefined}
            >
                <Input
                    id={inputId}
                    type="date"
                    required
                    min="2000-01-01"
                    max={todayInTashkent()}
                    value={startDate}
                    disabled={submitting || !isActive}
                    onChange={(event) => {
                        setStartDate(event.target.value);
                        setError('');
                    }}
                />
            </Field>
            <Button type="submit" className="w-full" disabled={submitting || !isActive}>
                <RefreshCcw aria-hidden="true" />
                {submitting ? t('common.saving') : t('terminals.sync.start')}
            </Button>
        </form>
    );
}
