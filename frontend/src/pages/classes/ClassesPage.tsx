import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, School as SchoolIcon, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPatch, authorizedPost } from '@/lib/auth-session';
import { academicYearFor, academicYearOptions, isValidAcademicYear, todayInTashkent } from '@/lib/date';
import type { School } from '@/types/school';

interface SchoolClass {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
    gradeLevel: number | null;
}

const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));

function useGradeOptions() {
    const { t } = useTranslation();
    return GRADES.map((grade) => ({ value: grade, label: t('calendar.gradeN', { grade }) }));
}

function GradeLevelEditor({ schoolClass, onSaved }: { schoolClass: SchoolClass; onSaved: () => void }) {
    const { t } = useTranslation();
    const gradeOptions = useGradeOptions();
    const [gradeLevel, setGradeLevel] = useState(schoolClass.gradeLevel == null ? '' : String(schoolClass.gradeLevel));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const saving = useRef(false);

    const unchanged = gradeLevel !== '' && Number(gradeLevel) === schoolClass.gradeLevel;

    async function handleSave() {
        if (saving.current || !gradeLevel || unchanged) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/classes/${schoolClass.id}/grade-level`, { gradeLevel: Number(gradeLevel) });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.gradeSaveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <SelectField
                    value={gradeLevel}
                    onValueChange={(value) => {
                        setGradeLevel(value);
                        setError('');
                    }}
                    disabled={busy}
                    placeholder={t('common.notSet')}
                    options={gradeOptions}
                    aria-label={t('classes.gradeOf', { name: schoolClass.name })}
                    className="h-9 min-w-0 flex-1"
                />
                {!unchanged && gradeLevel && (
                    <Button type="button" size="sm" disabled={busy} onClick={() => void handleSave()}>
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                )}
            </div>
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}

function ClassesList({ schoolId, academicYear, canCreate }: { schoolId: number; academicYear: string; canCreate: boolean }) {
    const { t } = useTranslation();
    const id = useId();
    const gradeOptions = useGradeOptions();
    const query = useApiQuery<SchoolClass[]>(`/classes?schoolId=${schoolId}&academicYear=${academicYear}`);

    const [name, setName] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const saving = useRef(false);

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current || !canCreate) return;
        const normalizedName = name.trim();
        setError('');
        setSuccess('');

        if (!normalizedName || !gradeLevel) return setError(t('classes.errors.required'));

        saving.current = true;
        setBusy(true);
        try {
            await authorizedPost<SchoolClass>('/classes', { schoolId, academicYear, name: normalizedName, gradeLevel: Number(gradeLevel) });
            setName('');
            setGradeLevel('');
            setSuccess(t('classes.created'));
            query.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.createFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    const classes = [...(query.data ?? [])].sort(
        (a, b) => (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99) || a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    const missingGradeCount = classes.filter((item) => item.gradeLevel == null).length;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            {canCreate && (
                <Card className="h-fit lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">{t('classes.createTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <Field htmlFor={`${id}-name`} label={t('classes.name')} required>
                                <Input
                                    id={`${id}-name`}
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder={t('classes.namePlaceholder')}
                                    maxLength={30}
                                    required
                                    disabled={busy}
                                />
                            </Field>
                            <Field htmlFor={`${id}-grade`} label={t('classes.grade')} required>
                                <SelectField
                                    id={`${id}-grade`}
                                    value={gradeLevel}
                                    onValueChange={setGradeLevel}
                                    required
                                    disabled={busy}
                                    placeholder={t('classes.chooseGrade')}
                                    options={gradeOptions}
                                />
                            </Field>
                            {error && <ErrorState message={error} />}
                            {success && <SuccessNotice>{success}</SuccessNotice>}
                            <Button type="submit" disabled={busy} className="w-full">
                                <Plus aria-hidden="true" />
                                {busy ? t('common.saving') : t('classes.add')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <section className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-semibold">{t('classes.listTitle')}</h2>
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="neutral" dot={false}>
                            {t('common.total', { count: classes.length })}
                        </StatusBadge>
                        {!query.loading && missingGradeCount > 0 && (
                            <StatusBadge tone="warning">{t('classes.missingGrade', { count: missingGradeCount })}</StatusBadge>
                        )}
                    </div>
                </div>

                {query.loading ? (
                    <LoadingState rows={4} />
                ) : query.error ? (
                    <ErrorState message={query.error} onRetry={query.retry} />
                ) : classes.length ? (
                    <ul className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {classes.map((schoolClass) => (
                            <li key={schoolClass.id}>
                                <Card size="sm" className="h-full gap-3 px-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-heading text-xl font-bold">{schoolClass.name}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">{schoolClass.academicYear}</span>
                                    </div>
                                    {canCreate ? (
                                        <GradeLevelEditor
                                            key={`${schoolClass.id}-${schoolClass.gradeLevel ?? 'none'}`}
                                            schoolClass={schoolClass}
                                            onSaved={query.retry}
                                        />
                                    ) : schoolClass.gradeLevel == null ? (
                                        <StatusBadge tone="warning">{t('classes.gradeMissing')}</StatusBadge>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('calendar.gradeN', { grade: schoolClass.gradeLevel })}</p>
                                    )}
                                    {canCreate && schoolClass.gradeLevel == null && (
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <TriangleAlert aria-hidden="true" className="size-3.5 text-warning" />
                                            {t('classes.gradeMissing')}
                                        </p>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState icon={SchoolIcon} title={t('classes.emptyTitle')} description={t('classes.empty')} />
                )}
            </section>
        </div>
    );
}

export function ClassesPage() {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const role = session?.profile.role;
    const canCreate = role === 'SUPER_ADMIN' || role === 'REGION_ADMIN' || role === 'DISTRICT_ADMIN' || role === 'SCHOOL_ADMIN';

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const [schoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(todayInTashkent()));

    const schools = schoolsQuery.data ?? [];
    const selectedSchool = schools.find((school) => String(school.id) === schoolId);
    const validYear = isValidAcademicYear(academicYear);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('classes.title')} description={t('classes.subtitle')} />

            <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field
                    htmlFor={`${id}-school`}
                    label={t('common.school')}
                    error={schoolsQuery.error || undefined}
                    hint={!schoolsQuery.loading && !schoolsQuery.error && schools.length === 0 ? t('classes.noSchools') : undefined}
                >
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={setSchoolId}
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error) || schools.length === 0}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        options={schools.map((school) => ({ value: String(school.id), label: `${school.name} — ${school.district.name}` }))}
                    />
                </Field>
                <Field htmlFor={`${id}-year`} label={t('members.academicYear')}>
                    <SelectField
                        id={`${id}-year`}
                        value={academicYear}
                        onValueChange={setAcademicYear}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>
            </div>

            {!schoolsQuery.loading && !schoolsQuery.error && selectedSchool && validYear ? (
                <ClassesList key={`${schoolId}-${academicYear}`} schoolId={selectedSchool.id} academicYear={academicYear} canCreate={canCreate} />
            ) : (
                !schoolsQuery.loading && <EmptyState icon={SchoolIcon} title={t('calendar.chooseTitle')} description={t('classes.choose')} />
            )}
        </div>
    );
}
