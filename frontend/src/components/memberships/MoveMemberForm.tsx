import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { academicYearFor, academicYearOptions, isValidAcademicYear, todayInTashkent } from '@/lib/date';
import { changeMembershipClass, transferSchoolMembership } from '@/lib/school-memberships-api';
import type { School } from '@/types/school';
import type { SchoolMembership } from '@/types/school-membership';

import { MemberSummary } from './MemberSummary';
import { SchoolClassSelect } from './SchoolClassSelect';
import { DatePicker } from '@/components/common/DatePicker';

export type MoveMode = 'class' | 'school';

interface Props {
    membership: SchoolMembership;
    /** Boshqa maktabga o‘tkazish huquqi (tuman, viloyat va bosh admin). Aks holda faqat sinf almashtiriladi. */
    canTransferSchool: boolean;
    onSaved: (mode: MoveMode) => void;
    onCancel: () => void;
}

/**
 * O‘quvchini o‘tkazish: bitta forma. Maktab o‘zgarmasa — sinf almashtiriladi,
 * boshqa maktab tanlansa — maktab almashtiriladi (ikki alohida forma o‘rniga).
 */
export function MoveMemberForm({ membership, canTransferSchool, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const saving = useRef(false);

    const [schoolId, setSchoolId] = useState(String(membership.schoolId));
    const [classId, setClassId] = useState('');
    const [academicYear, setAcademicYear] = useState(
        membership.schoolClass?.academicYear ?? academicYearFor(todayInTashkent()),
    );
    const [startDate, setStartDate] = useState(todayInTashkent);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data ?? [];
    const mode: MoveMode = Number(schoolId) === membership.schoolId ? 'class' : 'school';

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');

        if (!isValidAcademicYear(academicYear)) return setError(t('members.errors.academicYear'));
        if (!classId) return setError(t(mode === 'class' ? 'members.errors.chooseNewClass' : 'members.errors.chooseNewSchoolClass'));
        if (mode === 'class' && Number(classId) === membership.classId) return setError(t('members.errors.sameClass'));
        if (!startDate || startDate <= membership.startDate) return setError(t('members.errors.dateAfterStart'));
        if (mode === 'school' && !canTransferSchool) return setError(t('members.move.noTransferRight'));

        saving.current = true;
        setBusy(true);
        try {
            if (mode === 'class') {
                await changeMembershipClass(membership.id, { classId: Number(classId), startDate });
            } else {
                await transferSchoolMembership(membership.id, {
                    schoolId: Number(schoolId),
                    classId: Number(classId),
                    startDate,
                });
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t(mode === 'class' ? 'members.changeClass.failed' : 'members.transfer.failed'));
            return;
        } finally {
            saving.current = false;
            setBusy(false);
        }
        onSaved(mode);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <MemberSummary membership={membership} />

            <fieldset disabled={busy} className="space-y-4">
                <Field
                    htmlFor={`${id}-school`}
                    label={t('members.move.school')}
                    hint={canTransferSchool ? t('members.move.schoolHint') : t('members.move.schoolLocked')}
                    error={schoolsQuery.error || undefined}
                    required
                >
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={(value) => {
                            setSchoolId(value);
                            setClassId('');
                        }}
                        disabled={!canTransferSchool || schoolsQuery.loading || Boolean(schoolsQuery.error)}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        searchable
                        options={(canTransferSchool ? schools : schools.filter((school) => school.id === membership.schoolId)).map(
                            (school) => ({
                                value: String(school.id),
                                label: `${school.name} — ${school.district.name}`,
                            }),
                        )}
                    />
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

                    <SchoolClassSelect
                        key={`${schoolId}-${academicYear}`}
                        schoolId={Number(schoolId)}
                        academicYear={academicYear}
                        value={classId}
                        onChange={setClassId}
                        disabled={busy}
                        label={t('members.newClass')}
                    />
                </div>

                <Field htmlFor={`${id}-date`} label={t('members.changeClass.date')} hint={t('members.changeClass.hint')} required>
                    <DatePicker
                        id={`${id}-date`}
                        min={membership.startDate}
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        required
                    />
                </Field>
            </fieldset>

            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
                {t(mode === 'class' ? 'members.move.modeClass' : 'members.move.modeSchool')}
            </p>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy || !classId || schoolsQuery.loading}>
                    {busy ? t('common.saving') : t(mode === 'class' ? 'members.actions.changeClass' : 'members.actions.transfer')}
                </Button>
            </div>
        </form>
    );
}
