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
import { schoolScopeOptions } from '@/lib/school-scope';
import type { School } from '@/types/school';

type FilterName = 'regionId' | 'districtId' | 'schoolId' | 'q' | 'status';

function SearchForm({
    initialValue,
    onSearch,
}: {
    initialValue: string;
    onSearch: (value: string) => void;
}) {
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
                {t('common.search')}
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
                        placeholder={t('members.searchPlaceholder')}
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

export function SchoolMembersFilters() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const ids = useId();

    const { data: schools, loading, error, retry } = useApiQuery<School[]>('/schools');

    const role = session?.profile.role;
    const regionId = searchParams.get('regionId') ?? '';
    const districtId = searchParams.get('districtId') ?? '';
    const schoolId = searchParams.get('schoolId') ?? '';
    const search = searchParams.get('q') ?? '';
    const status = searchParams.get('status') ?? '';

    const canSelectRegion = role === 'SUPER_ADMIN';
    const canSelectDistrict = role === 'SUPER_ADMIN' || role === 'REGION_ADMIN';
    const canSelectSchool = canSelectDistrict || role === 'DISTRICT_ADMIN';

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
        const next = new URLSearchParams(searchParams);
        (['regionId', 'districtId', 'schoolId', 'q', 'status'] as const).forEach((key) => next.delete(key));
        next.set('page', '1');
        setSearchParams(next);
    }

    const hasFilters = Boolean(regionId || districtId || schoolId || search || status);

    return (
        <section
            aria-label={t('common.filters')}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
            <SearchForm
                key={searchParams.get('q') ?? ''}
                initialValue={search}
                onSearch={(value) => changeFilter('q', value)}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field htmlFor={`${ids}-status`} label={t('members.status')}>
                    <SelectField
                        id={`${ids}-status`}
                        value={status}
                        onValueChange={(value) => changeFilter('status', value)}
                        emptyOption={t('common.all')}
                        options={(['ACTIVE', 'ENDED', 'PLANNED'] as const).map((value) => ({
                            value,
                            label: t(`common.membershipStatus.${value}`),
                        }))}
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
