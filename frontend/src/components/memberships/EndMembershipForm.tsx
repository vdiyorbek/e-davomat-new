import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDays } from '@/lib/date';
import { endSchoolMembership } from '@/lib/school-memberships-api';
import type { SchoolMembership } from '@/types/school-membership';

import { MemberSummary } from './MemberSummary';

interface EndMembershipFormProps {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

export function EndMembershipForm({ membership, onSaved, onCancel }: EndMembershipFormProps) {
    const { t } = useTranslation();
    const inputId = useId();
    const busyRef = useRef(false);

    const [endDate, setEndDate] = useState(membership.endDate ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busyRef.current) return;
        setError('');

        if (!endDate || endDate <= membership.startDate) {
            setError(t('members.end.errorBeforeStart'));
            return;
        }
        if (membership.endDate && endDate > membership.endDate) {
            setError(t('members.end.errorExtend'));
            return;
        }

        busyRef.current = true;
        setBusy(true);
        try {
            await endSchoolMembership(membership.id, endDate);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('members.end.failed'));
            return;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <MemberSummary membership={membership} />

            <Field htmlFor={inputId} label={t('membership.endExclusive')} hint={t('members.end.hint')} required>
                <Input
                    id={inputId}
                    type="date"
                    required
                    min={addDays(membership.startDate, 1)}
                    max={membership.endDate ?? '9999-12-31'}
                    value={endDate}
                    disabled={busy}
                    onChange={(event) => setEndDate(event.target.value)}
                />
            </Field>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('members.end.submit')}
                </Button>
            </div>
        </form>
    );
}
