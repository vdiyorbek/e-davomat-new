import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearOptions, isValidAcademicYear } from '@/lib/date';
import { useGradeOptions } from '@/lib/grades';
import type { School } from '@/types/school';
import type { SchoolClass } from '@/types/school-class';

interface Props {
    initialSchoolId?: string;
    initialAcademicYear: string;
    onSaved: (created: SchoolClass) => void;
    onCancel: () => void;
}

export function CreateClassForm({ initialSchoolId = '', initialAcademicYear, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const gradeOptions = useGradeOptions();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data ?? [];

    const [schoolId, setSchoolId] = useState(initialSchoolId);
    const [academicYear, setAcademicYear] = useState(initialAcademicYear);
    const [name, setName] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const saving = useRef(false);

    // Faqat bitta maktab ruxsat etilgan bo‘lsa (maktab admini) — avtomatik tanlanadi.
    const effectiveSchoolId = schoolId || (schools.length === 1 ? String(schools[0].id) : '');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');

        const normalizedName = name.trim();
        if (!effectiveSchoolId || !isValidAcademicYear(academicYear)) return setError(t('classes.errors.school'));
        if (!normalizedName || !gradeLevel) return setError(t('classes.errors.required'));

        saving.current = true;
        setBusy(true);
        try {
            const created = await authorizedPost<SchoolClass>('/classes', {
                schoolId: Number(effectiveSchoolId),
                academicYear,
                name: normalizedName,
                gradeLevel: Number(gradeLevel),
            });
            onSaved(created);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.createFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Field htmlFor={`${id}-school`} label={t('common.school')} required error={schoolsQuery.error || undefined}>
                <SelectField
                    id={`${id}-school`}
                    value={effectiveSchoolId}
                    onValueChange={setSchoolId}
                    disabled={busy || schoolsQuery.loading || Boolean(schoolsQuery.error)}
                    placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                    options={schools.map((school) => ({
                        value: String(school.id),
                        label: `${school.name} — ${school.district.name}`,
                        keywords: `${school.name} ${school.district.name}`,
                    }))}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-year`} label={t('members.academicYear')} required>
                    <SelectField
                        id={`${id}-year`}
                        value={academicYear}
                        onValueChange={setAcademicYear}
                        disabled={busy}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>
                <Field htmlFor={`${id}-grade`} label={t('classes.grade')} required>
                    <SelectField
                        id={`${id}-grade`}
                        value={gradeLevel}
                        onValueChange={setGradeLevel}
                        disabled={busy}
                        placeholder={t('classes.chooseGrade')}
                        options={gradeOptions}
                    />
                </Field>
            </div>

            <Field htmlFor={`${id}-name`} label={t('classes.name')} required>
                <Input
                    id={`${id}-name`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('classes.namePlaceholder')}
                    maxLength={30}
                    disabled={busy}
                />
            </Field>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    <Plus aria-hidden="true" />
                    {busy ? t('common.saving') : t('classes.add')}
                </Button>
            </div>
        </form>
    );
}