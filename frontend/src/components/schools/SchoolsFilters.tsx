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
import { schoolScopeOptions } from '@/lib/school-scope';
import { cn } from '@/lib/utils';
import type { School } from '@/types/school';

type FilterName = 'regionId' | 'districtId' | 'q';

export function SchoolsFilters() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const ids = useId();

    const role = session?.profile.role;
    const canSelectRegion = role === 'SUPER_ADMIN';
    const canSelectDistrict = role === 'SUPER_ADMIN' || role === 'REGION_ADMIN';

    // Viloyat va tuman variantlari ruxsat berilgan maktablardan olinadi.
    const { data: schools, loading, error, retry } = useApiQuery<School[]>('/schools');

    const regionId = searchParams.get('regionId') ?? '';
    const districtId = searchParams.get('districtId') ?? '';
    const search = searchParams.get('q') ?? '';

    const advancedCount = [regionId, districtId].filter(Boolean).length;
    const [expanded, setExpanded] = useState(advancedCount > 0);

    const scope = schoolScopeOptions(schools, regionId, districtId);
    const optionsDisabled = loading || Boolean(error);

    function changeFilter(name: FilterName, value: string) {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(name, value);
        else next.delete(name);

        if (name === 'regionId') next.delete('districtId');

        next.set('page', '1');
        setSearchParams(next);
    }

    function clearFilters() {
        const next = new URLSearchParams(searchParams);
        (['regionId', 'districtId', 'q'] as const).forEach((key) => next.delete(key));
        next.set('page', '1');
        setSearchParams(next);
    }

    const hasFilters = Boolean(regionId || districtId || search);

    return (
        <section
            aria-label={t('common.filters')}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
            {/* Asosiy qator: qidiruv va «Ko‘proq filtr» */}
            <div className={cn('grid gap-4', canSelectDistrict && 'md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
                <FilterSearchForm
                    key={search}
                    label={t('schools.search')}
                    placeholder={t('schools.searchPlaceholder')}
                    initialValue={search}
                    onSearch={(value) => changeFilter('q', value)}
                />

                {canSelectDistrict && (
                    <FilterToggle
                        expanded={expanded}
                        count={advancedCount}
                        controls={`${ids}-advanced`}
                        onToggle={() => setExpanded((value) => !value)}
                    />
                )}
            </div>

            {/* Kengaytirilgan: hudud filtrlari */}
            {canSelectDistrict && (
                <div id={`${ids}-advanced`} hidden={!expanded} className="grid gap-4 border-t pt-4 sm:grid-cols-2">
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

                    {error && (
                        <div className="sm:col-span-2">
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