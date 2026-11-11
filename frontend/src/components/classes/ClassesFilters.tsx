import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { academicYearOptions } from '@/lib/date';
import { useGradeOptions } from '@/lib/grades';
import { schoolScopeOptions } from '@/lib/school-scope';
import type { School } from '@/types/school';

type FilterName = 'q' | 'academicYear' | 'grade' | 'regionId' | 'districtId' | 'schoolId';

function SearchForm({ initialValue, onSearch }: { initialValue: string; onSearch: (value: string) => void }) {
    const { t } = useTranslation();
    const id = useId();
    const [value, setValue] = useState(initialValue);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(value.trim().replace(/\s+/g, ' '));
    }

    return (
        <form onSubmit={handleSubmit} role="search" className="min-w-0">
            <label htmlFor={id} className="sr-only">
                {t('classes.search')}
            </label>
            <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        id={id}
                        type="search"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        maxLength={100}
                        placeholder={t('classes.searchPlaceholder')}
                        className="pl-10"
                    />
                </div>
                <Button type="submit" className="h-11 shrink-0">
                    <Search aria-hidden="true" className="sm:hidden" />
                    <span className="max-sm:sr-only">{t('common.search')}</span>
                </Button>
            </div>
        </form>
    );
}

export function ClassesFilters({ academicYear }: { academicYear: string }) {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const ids = useId();
    const gradeOptions = useGradeOptions();

    const role = session?.profile.role;
    const canSelectRegion = role === 'SUPER_ADMIN';
    const canSelectDistrict = role === 'SUPER_ADMIN' || role === 'REGION_ADMIN';
    const canSelectSchool = canSelectDistrict || role === 'DISTRICT_ADMIN';

    const { data: schools, loading, error, retry } = useApiQuery<School[]>('/schools');

    const search = searchParams.get('q') ?? '';
    const grade = searchParams.get('grade') ?? '';
    const regionId = searchParams.get('regionId') ?? '';
    const districtId = searchParams.get('districtId') ?? '';
    const schoolId = searchParams.get('schoolId') ?? '';

    const scope = schoolScopeOptions(schools, regionId, districtId);
    const optionsDisabled = loading || Boolean(error);

    function changeFilter(name: FilterName, value: string) {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(name, value);
        else next.delete(name);

        if (name === 'regionId') {
            next.delete('districtId');
            next.delete('schoolId');
        }
        if (name === 'districtId') next.delete('schoolId');

        next.set('page', '1');
        setSearchParams(next);
    }

    function clearFilters() {
        // O‘quv yili saqlanadi — u filtr emas, ko‘rilayotgan davr.
        const next = new URLSearchParams();
        if (searchParams.get('academicYear')) next.set('academicYear', academicYear);
        setSearchParams(next);
    }

    const hasFilters = Boolean(search || grade || regionId || districtId || schoolId);

    return (
        <section
            aria-label={t('common.filters')}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
            <SearchForm key={search} initialValue={search} onSearch={(value) => changeFilter('q', value)} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Field htmlFor={`${ids}-year`} label={t('members.academicYear')}>
                    <SelectField
                        id={`${ids}-year`}
                        value={academicYear}
                        onValueChange={(value) => changeFilter('academicYear', value)}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>

                <Field htmlFor={`${ids}-grade`} label={t('classes.grade')}>
                    <SelectField
                        id={`${ids}-grade`}
                        value={grade}
                        onValueChange={(value) => changeFilter('grade', value)}
                        emptyOption={t('classes.allGrades')}
                        options={[...gradeOptions, { value: 'NONE', label: t('classes.gradeMissing') }]}
                    />
                </Field>

                {canSelectRegion && (
                    <Field htmlFor={`${ids}-region`} label={t('common.region')}>
                        <SelectField
                            id={`${ids}-region`}
                            value={regionId}
                            onValueChange={(value) => changeFilter('regionId', value)}
                            emptyOption={t('filters.allRegions')}
                            options={scope.regions}
                            disabled={optionsDisabled}
                        />
                    </Field>
                )}

                {canSelectDistrict && (
                    <Field htmlFor={`${ids}-district`} label={t('common.district')}>
                        <SelectField
                            id={`${ids}-district`}
                            value={districtId}
                            onValueChange={(value) => changeFilter('districtId', value)}
                            emptyOption={t('filters.allDistricts')}
                            options={scope.districts}
                            disabled={optionsDisabled}
                        />
                    </Field>
                )}

                {canSelectSchool && (
                    <Field htmlFor={`${ids}-school`} label={t('common.school')}>
                        <SelectField
                            id={`${ids}-school`}
                            value={schoolId}
                            onValueChange={(value) => changeFilter('schoolId', value)}
                            emptyOption={t('filters.allSchools')}
                            options={scope.schools}
                            disabled={optionsDisabled}
                        />
                    </Field>
                )}
            </div>

            {error && canSelectSchool && <ErrorState message={error} onRetry={retry} />}

            {hasFilters && (
                <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                        <X aria-hidden="true" />
                        {t('common.clearFilters')}
                    </Button>
                </div>
            )}
        </section>
    );
}