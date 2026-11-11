import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { FilterSearchForm } from '@/components/common/FilterSearchForm';
import { FilterToggle } from '@/components/common/FilterToggle';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { academicYearOptions } from '@/lib/date';
import { useGradeOptions } from '@/lib/grades';
import { schoolScopeOptions } from '@/lib/school-scope';
import type { School } from '@/types/school';

type FilterName = 'q' | 'academicYear' | 'grade' | 'regionId' | 'districtId' | 'schoolId';

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

    const advancedCount = [regionId, districtId, schoolId].filter(Boolean).length;
    const [expanded, setExpanded] = useState(advancedCount > 0);

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
        // O‘quv yili va sahifa hajmi saqlanadi — ular filtr emas.
        const next = new URLSearchParams();
        if (searchParams.get('academicYear')) next.set('academicYear', academicYear);
        const limit = searchParams.get('limit');
        if (limit) next.set('limit', limit);
        setSearchParams(next);
    }

    const hasFilters = Boolean(search || grade || regionId || districtId || schoolId);

    return (
        <section
            aria-label={t('common.filters')}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
            {/* Asosiy qator: qidiruv, o‘quv yili, daraja va «Ko‘proq filtr» */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                <FilterSearchForm
                    key={search}
                    className="sm:col-span-2 xl:col-span-1"
                    label={t('classes.search')}
                    placeholder={t('classes.searchPlaceholder')}
                    initialValue={search}
                    onSearch={(value) => changeFilter('q', value)}
                />

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

                {canSelectSchool && (
                    <FilterToggle
                        className="sm:col-span-2 md:w-full xl:col-span-1 xl:w-auto"
                        expanded={expanded}
                        count={advancedCount}
                        controls={`${ids}-advanced`}
                        onToggle={() => setExpanded((value) => !value)}
                    />
                )}
            </div>

            {/* Kengaytirilgan: viloyat → tuman → maktab */}
            {canSelectSchool && (
                <div id={`${ids}-advanced`} hidden={!expanded} className="grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-3">
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

                    {error && (
                        <div className="sm:col-span-2 xl:col-span-3">
                            <ErrorState message={error} onRetry={retry} />
                        </div>
                    )}
                </div>
            )}

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