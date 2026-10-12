
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';
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

interface DistrictOption extends Option {
    regionId: number;
}

const fieldClass =
    'w-full min-w-0 rounded-xl border bg-background px-3 py-2.5 text-sm ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

function DistrictFilter({
    regionId,
    selected,
    disabled,
    onChange,
}: {
    regionId: string;
    selected: string;
    disabled: boolean;
    onChange: (id: string) => void;
}) {
    const { data, loading, error, retry } =
        useApiQuery<DistrictOption[]>(
            `/districts/options?regionId=${encodeURIComponent(regionId)}`,
        );

    return (
        <div className="space-y-1">
            <label htmlFor="users-district" className="text-sm">
                Tuman / shahar
            </label>
            <select
                id="users-district"
                className={fieldClass}
                value={selected}
                disabled={disabled || loading || Boolean(error)}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Barcha tumanlar</option>
                {(data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
            </select>
            {error && (
                <button
                    type="button"
                    className="text-xs text-destructive underline"
                    onClick={retry}
                >
                    Tumanlarni qayta yuklash
                </button>
            )}
        </div>
    );
}

export function UsersFilters({
    value,
    onChange,
    onReset,
}: Props) {
    const { session } = useAuth();
    const profile = session?.profile;

    const { data: regions, loading: regionsLoading,
        error: regionsError, retry: retryRegions } =
        useApiQuery<Option[]>('/regions/options');

    // Backend bu ro‘yxatni foydalanuvchining vakolati
    // asosida cheklaydi.
    const { data: schools, loading: schoolsLoading,
        error: schoolsError, retry: retrySchools } =
        useApiQuery<School[]>('/schools');

    const role = profile?.role;

    const isSuper = role === 'SUPER_ADMIN';
    const isRegion = role === 'REGION_ADMIN';
    const isDistrict = role === 'DISTRICT_ADMIN';
    const isSchool = role === 'SCHOOL_ADMIN';

    const scopedSchools = schools ?? [];

    // DISTRICT_ADMIN uchun viloyatni maktab ma’lumotidan
    // aniqlash mumkin. Ammo filtrda bu majburiy emas.
    const effectiveRegionId = isRegion
        ? String(profile?.regionId ?? '')
        : value.regionId;

    const availableRegions = (regions ?? []).filter(
        (region) =>
            isSuper ||
            (isRegion && region.id === profile?.regionId),
    );

    const availableSchools = scopedSchools.filter((school) => {
        if (isSchool && school.id !== profile?.schoolId) {
            return false;
        }

        if (isDistrict && school.districtId !== profile?.districtId) {
            return false;
        }

        if (
            effectiveRegionId &&
            school.district.regionId !== Number(effectiveRegionId)
        ) {
            return false;
        }

        if (
            value.districtId &&
            school.districtId !== Number(value.districtId)
        ) {
            return false;
        }

        return true;
    });

    function update(
        changes: Partial<UsersFilterValues>,
    ) {
        onChange({ ...value, ...changes });
    }

    function changeRegion(regionId: string) {
        update({
            regionId,
            districtId: '',
            schoolId: '',
        });
    }

    function changeDistrict(districtId: string) {
        update({
            districtId,
            schoolId: '',
        });
    }

    return (
        <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                    <label htmlFor="users-search" className="text-sm">
                        F.I.Sh. yoki login
                    </label>
                    <input
                        id="users-search"
                        className={fieldClass}
                        placeholder="Qidirish..."
                        maxLength={100}
                        value={value.search}
                        onChange={(e) => update({ search: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="users-role" className="text-sm">
                        Rol
                    </label>
                    <select
                        id="users-role"
                        className={fieldClass}
                        value={value.role}
                        onChange={(e) =>
                            update({ role: e.target.value as UsersFilterValues['role'] })
                        }
                    >
                        <option value="">Barcha rollar</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="REGION_ADMIN">REGION_ADMIN</option>
                        <option value="DISTRICT_ADMIN">DISTRICT_ADMIN</option>
                        <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                        <option value="USER">USER</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="users-status" className="text-sm">
                        Holat
                    </label>
                    <select
                        id="users-status"
                        className={fieldClass}
                        value={value.isActive}
                        onChange={(e) =>
                            update({
                                isActive: e.target.value as UsersFilterValues['isActive'],
                            })
                        }
                    >
                        <option value="">Barcha holatlar</option>
                        <option value="true">Faol</option>
                        <option value="false">Bloklangan</option>
                    </select>
                </div>

                {isSuper && (
                    <div className="space-y-1">
                        <label htmlFor="users-region" className="text-sm">
                            Viloyat
                        </label>
                        <select
                            id="users-region"
                            className={fieldClass}
                            value={value.regionId}
                            disabled={regionsLoading || Boolean(regionsError)}
                            onChange={(e) => changeRegion(e.target.value)}
                        >
                            <option value="">Barcha viloyatlar</option>
                            {availableRegions.map((region) => (
                                <option key={region.id} value={region.id}>
                                    {region.name}
                                </option>
                            ))}
                        </select>
                        {regionsError && (
                            <button
                                type="button"
                                className="text-xs text-destructive underline"
                                onClick={retryRegions}
                            >
                                Viloyatlarni qayta yuklash
                            </button>
                        )}
                    </div>
                )}

                {isRegion && (
                    <div className="space-y-1">
                        <span className="text-sm">Biriktirilgan viloyat</span>
                        <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
                            {availableRegions[0]?.name ?? 'Aniqlanmoqda...'}
                        </p>
                    </div>
                )}

                {(isSuper || isRegion) && effectiveRegionId && (
                    <DistrictFilter
                        key={effectiveRegionId}
                        regionId={effectiveRegionId}
                        selected={value.districtId}
                        disabled={false}
                        onChange={changeDistrict}
                    />
                )}

                {isDistrict && (
                    <div className="space-y-1">
                        <span className="text-sm">Biriktirilgan tuman</span>
                        <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
                            {scopedSchools[0]?.district.name ??
                                `Tuman ID: ${profile?.districtId ?? '—'}`}
                        </p>
                    </div>
                )}

                {(isSuper || isRegion || isDistrict) && (
                    <div className="space-y-1">
                        <label htmlFor="users-school" className="text-sm">
                            Maktab
                        </label>
                        <select
                            id="users-school"
                            className={fieldClass}
                            value={value.schoolId}
                            disabled={
                                schoolsLoading ||
                                Boolean(schoolsError) ||
                                (isSuper && !value.regionId) ||
                                (isRegion && !effectiveRegionId)
                            }
                            onChange={(e) =>
                                update({ schoolId: e.target.value })
                            }
                        >
                            <option value="">Barcha maktablar</option>
                            {availableSchools.map((school) => (
                                <option key={school.id} value={school.id}>
                                    {school.name}
                                </option>
                            ))}
                        </select>
                        {schoolsError && (
                            <button
                                type="button"
                                className="text-xs text-destructive underline"
                                onClick={retrySchools}
                            >
                                Maktablarni qayta yuklash
                            </button>
                        )}
                    </div>
                )}

                {isSchool && (
                    <div className="space-y-1">
                        <span className="text-sm">Biriktirilgan maktab</span>
                        <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
                            {scopedSchools[0]?.name ??
                                `Maktab ID: ${profile?.schoolId ?? '—'}`}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end border-t pt-4">
                <button
                    type="button"
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                    onClick={onReset}
                >
                    Filtrlarni tozalash
                </button>
            </div>
        </div>
    );
}
