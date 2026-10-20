import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    academicYearFor,
    academicYearOptions,
    isValidAcademicYear,
    todayInTashkent,
} from '@/lib/date';
import { changeMembershipClass } from '@/lib/school-memberships-api';
import type { SchoolMembership } from '@/types/school-membership';

import { MemberSummary } from './MemberSummary';
import { SchoolClassSelect } from './SchoolClassSelect';

interface Props {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

export function ChangeClassForm({ membership, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const saving = useRef(false);

    const [startDate, setStartDate] = useState(todayInTashkent);
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(todayInTashkent()));
    const [classId, setClassId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');

        if (!isValidAcademicYear(academicYear)) {
            setError(t('members.errors.academicYear'));
            return;
        }
        if (!classId) {
            setError(t('members.errors.chooseNewClass'));
            return;
        }
        if (Number(classId) === membership.classId) {
            setError(t('members.errors.sameClass'));
            return;
        }
        if (!startDate || startDate <= membership.startDate) {
            setError(t('members.errors.dateAfterStart'));
            return;
        }

        saving.current = true;
        setBusy(true);
        try {
            await changeMembershipClass(membership.id, { classId: Number(classId), startDate });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('members.changeClass.failed'));
            return;
        } finally {
            saving.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <MemberSummary membership={membership} />

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-year`} label={t('members.newClassYear')} required>
                    <SelectField
                        id={`${id}-year`}
                        value={academicYear}
                        onValueChange={(value) => {
                            setAcademicYear(value);
                            setClassId('');
                        }}
                        disabled={busy}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>

                <SchoolClassSelect
                    key={`${membership.schoolId}-${academicYear}`}
                    schoolId={membership.schoolId}
                    academicYear={academicYear}
                    value={classId}
                    onChange={setClassId}
                    disabled={busy}
                    label={t('members.newClass')}
                />
            </div>

            <Field htmlFor={`${id}-date`} label={t('members.changeClass.date')} hint={t('members.changeClass.hint')} required>
                <Input
                    id={`${id}-date`}
                    type="date"
                    min={membership.startDate}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                    disabled={busy}
                />
            </Field>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('members.actions.changeClass')}
                </Button>
            </div>
        </form>
    );
}
