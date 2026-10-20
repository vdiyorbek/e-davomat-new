import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { academicYearFor, academicYearOptions, isValidAcademicYear, todayInTashkent } from '@/lib/date';
import { transferSchoolMembership } from '@/lib/school-memberships-api';
import type { School } from '@/types/school';
import type { SchoolMembership } from '@/types/school-membership';

import { MemberSummary } from './MemberSummary';
import { SchoolClassSelect } from './SchoolClassSelect';

interface Props {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}

export function TransferSchoolForm({ membership, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const saving = useRef(false);

    const [schoolId, setSchoolId] = useState('');
    const [classId, setClassId] = useState('');
    const [academicYear, setAcademicYear] = useState(
        membership.schoolClass?.academicYear ?? academicYearFor(todayInTashkent()),
    );
    const [startDate, setStartDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = (schoolsQuery.data ?? []).filter((school) => school.id !== membership.schoolId);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');

        const selectedSchool = schools.find((school) => String(school.id) === schoolId);
        if (schoolsQuery.loading || schoolsQuery.error || !selectedSchool) {
            setError(t('members.errors.chooseNewSchool'));
            return;
        }
        if (!isValidAcademicYear(academicYear)) {
            setError(t('members.errors.academicYear'));
            return;
        }
        if (!classId) {
            setError(t('members.errors.chooseNewSchoolClass'));
            return;
        }
        if (!startDate || startDate <= membership.startDate) {
            setError(t('members.errors.dateAfterStart'));
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
            setError(err instanceof Error ? err.message : t('members.transfer.failed'));
            return;
        } finally {
            saving.current = false;
            setBusy(false);
        }
        onSaved();
    }

    const noSchools = !schoolsQuery.loading && !schoolsQuery.error && schools.length === 0;

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <MemberSummary membership={membership} />

            <fieldset disabled={busy} className="space-y-4">
                <Field
                    htmlFor={`${id}-school`}
                    label={t('members.transfer.newSchool')}
                    required
                    error={schoolsQuery.error || undefined}
                    hint={noSchools ? t('members.transfer.noSchools') : undefined}
                >
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={(value) => {
                            setSchoolId(value);
                            setClassId('');
                        }}
                        required
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error) || schools.length === 0}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        searchable
                        options={schools.map((school) => ({
                            value: String(school.id),
                            label: `${school.name} — ${school.district.name}`,
                        }))}
                    />
                    {schoolsQuery.error && (
                        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={schoolsQuery.retry}>
                            {t('common.retry')}
                        </Button>
                    )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-year`} label={t('members.academicYear')} required>
                        <SelectField
                            id={`${id}-year`}
                            value={academicYear}
                            onValueChange={(value) => {
                                setAcademicYear(value);
                                setClassId('');
                            }}
                            options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                        />
                    </Field>

                    {schoolId ? (
                        <SchoolClassSelect
                            key={`${schoolId}-${academicYear}`}
                            schoolId={Number(schoolId)}
                            academicYear={academicYear}
                            value={classId}
                            onChange={setClassId}
                            disabled={busy}
                        />
                    ) : (
                        <Field htmlFor={`${id}-class`} label={t('common.class')} required>
                            <SelectField
                                id={`${id}-class`}
                                value=""
                                onValueChange={() => undefined}
                                disabled
                                placeholder={t('members.chooseSchoolFirst')}
                                options={[]}
                            />
                        </Field>
                    )}
                </div>

                <Field htmlFor={`${id}-date`} label={t('members.transfer.date')} hint={t('members.transfer.hint')} required>
                    <Input
                        id={`${id}-date`}
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        min={membership.startDate}
                        required
                    />
                </Field>
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button
                    type="submit"
                    disabled={busy || schoolsQuery.loading || Boolean(schoolsQuery.error) || !schoolId || !classId}
                >
                    {busy ? t('common.saving') : t('members.actions.transfer')}
                </Button>
            </div>
        </form>
    );
}
