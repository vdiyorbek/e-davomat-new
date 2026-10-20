import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/auth';
import type { School } from '@/types/school';

export interface UsersFilterValues {
    search: string;
    role: UserRole | '';
    isActive: '' | 'true' | 'false';
    regionId: string;
    districtId: string;
    schoolId: string;
}

interface Props {
    value: UsersFilterValues;
    onChange: (value: UsersFilterValues) => void;
    onReset: () => void;
}

interface Option {
    id: number;
    name: string;
}

const ROLES: UserRole[] = ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN', 'USER'];

function DistrictFilter({
    regionId,
    selected,
    onChange,
}: {
    regionId: string;
    selected: string;
    onChange: (id: string) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const { data, loading, error, retry } = useApiQuery<Option[]>(`/districts/options?regionId=${encodeURIComponent(regionId)}`);

    return (
        <Field htmlFor={id} label={t('common.district')} error={error || undefined}>
            <SelectField
                id={id}
                value={selected}
                disabled={loading || Boolean(error)}
                onValueChange={onChange}
                emptyOption={t('filters.allDistricts')}
                options={(data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
            />
            {error && (
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={retry}>
                    {t('common.retry')}
                </Button>
            )}
        </Field>
    );
}

function ReadOnlyScope({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm leading-5 font-semibold">{label}</span>
            <p className="flex h-11 items-center truncate rounded-xl border bg-muted/40 px-3.5 text-sm">{value}</p>
        </div>
    );
}

export function UsersFilters({ value, onChange, onReset }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const profile = session?.profile;

    const { data: regions, loading: regionsLoading, error: regionsError } = useApiQuery<Option[]>('/regions/options');
    // Backend bu ro‘yxatni foydalanuvchining vakolati asosida cheklaydi.
    const { data: schools, loading: schoolsLoading, error: schoolsError } = useApiQuery<School[]>('/schools');

    const role = profile?.role;
    const isSuper = role === 'SUPER_ADMIN';
    const isRegion = role === 'REGION_ADMIN';
    const isDistrict = role === 'DISTRICT_ADMIN';
    const isSchool = role === 'SCHOOL_ADMIN';
    const scopedSchools = schools ?? [];

    const effectiveRegionId = isRegion ? String(profile?.regionId ?? '') : value.regionId;
    const availableRegions = (regions ?? []).filter((region) => isSuper || (isRegion && region.id === profile?.regionId));

    const availableSchools = scopedSchools.filter((school) => {
        if (isSchool && school.id !== profile?.schoolId) return false;
        if (isDistrict && school.districtId !== profile?.districtId) return false;
        if (effectiveRegionId && school.district.regionId !== Number(effectiveRegionId)) return false;
        if (value.districtId && school.districtId !== Number(value.districtId)) return false;
        return true;
    });

    function update(changes: Partial<UsersFilterValues>) {
        onChange({ ...value, ...changes });
    }

    const hasFilters = Object.values(value).some(Boolean);

    return (
        <section aria-label={t('common.filters')} className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field htmlFor={`${id}-search`} label={t('users.filters.search')} className="sm:col-span-2 xl:col-span-2">
                    <div className="relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id={`${id}-search`}
                            type="search"
                            placeholder={t('common.searchPlaceholder')}
                            maxLength={100}
                            value={value.search}
                            onChange={(event) => update({ search: event.target.value })}
                            className="pl-10"
                        />
                    </div>
                </Field>

                <Field htmlFor={`${id}-role`} label={t('users.role')}>
                    <SelectField
                        id={`${id}-role`}
                        value={value.role}
                        onValueChange={(next) => update({ role: next as UsersFilterValues['role'] })}
                        emptyOption={t('users.filters.allRoles')}
                        options={ROLES.map((item) => ({ value: item, label: t(`roles.${item}`) }))}
                    />
                </Field>

                <Field htmlFor={`${id}-status`} label={t('common.status')}>
                    <SelectField
                        id={`${id}-status`}
                        value={value.isActive}
                        onValueChange={(next) => update({ isActive: next as UsersFilterValues['isActive'] })}
                        emptyOption={t('filters.allStatuses')}
                        options={[
                            { value: 'true', label: t('users.active') },
                            { value: 'false', label: t('users.blocked') },
                        ]}
                    />
                </Field>

                {isSuper && (
                    <Field htmlFor={`${id}-region`} label={t('common.region')} error={regionsError || undefined}>
                        <SelectField
                            id={`${id}-region`}
                            value={value.regionId}
                            disabled={regionsLoading || Boolean(regionsError)}
                            onValueChange={(regionId) => update({ regionId, districtId: '', schoolId: '' })}
                            emptyOption={t('filters.allRegions')}
                            options={availableRegions.map((region) => ({ value: String(region.id), label: region.name }))}
                        />
                    </Field>
                )}

                {isRegion && <ReadOnlyScope label={t('users.filters.assignedRegion')} value={availableRegions[0]?.name ?? t('common.loading')} />}

                {(isSuper || isRegion) && effectiveRegionId && (
                    <DistrictFilter
                        key={effectiveRegionId}
                        regionId={effectiveRegionId}
                        selected={value.districtId}
                        onChange={(districtId) => update({ districtId, schoolId: '' })}
                    />
                )}

                {isDistrict && (
                    <ReadOnlyScope
                        label={t('users.filters.assignedDistrict')}
                        value={scopedSchools[0]?.district.name ?? `ID: ${profile?.districtId ?? '—'}`}
                    />
                )}

                {(isSuper || isRegion || isDistrict) && (
                    <Field htmlFor={`${id}-school`} label={t('common.school')} error={schoolsError || undefined}>
                        <SelectField
                            id={`${id}-school`}
                            value={value.schoolId}
                            disabled={schoolsLoading || Boolean(schoolsError) || (isSuper && !value.regionId) || (isRegion && !effectiveRegionId)}
                            onValueChange={(schoolId) => update({ schoolId })}
                            emptyOption={isSuper && !value.regionId ? t('users.filters.chooseRegionFirst') : t('filters.allSchools')}
                            options={availableSchools.map((school) => ({ value: String(school.id), label: school.name }))}
                        />
                    </Field>
                )}

                {isSchool && (
                    <ReadOnlyScope label={t('users.filters.assignedSchool')} value={scopedSchools[0]?.name ?? `ID: ${profile?.schoolId ?? '—'}`} />
                )}
            </div>

            {hasFilters && (
                <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                        <X aria-hidden="true" />
                        {t('common.clearFilters')}
                    </Button>
                </div>
            )}
        </section>
    );
}
