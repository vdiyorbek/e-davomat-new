
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { authorizedPatch } from '@/lib/auth-session';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/auth';

interface Option {
    id: number;
    name: string;
}

interface DistrictOption extends Option {
    regionId: number;
}

interface SchoolOption extends Option {
    districtId: number;
}

export interface AccessUser {
    id: number;
    login: string;
    role: UserRole;
    isActive: boolean;
    scope: {
        regionId: number | null;
        districtId: number | null;
        schoolId: number | null;
    };
    region: Option | null;
    district: Option | null;
    school: Option | null;
}

interface Props {
    user: AccessUser;
    onUpdated: () => void;
    onCancel: () => void;
}

const fieldClass =
    'w-full rounded-xl border bg-background px-3 py-3 text-sm ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

function DistrictPicker({
    regionId, value, onChange, disabled,
}: {
    regionId: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    const { data, loading, error, retry } =
        useApiQuery<DistrictOption[]>(
            `/districts/options?regionId=${regionId}`,
        );

    return (
        <div className="space-y-2">
            <label htmlFor="access-district">Туман / шаҳар</label>
            <select
                id="access-district"
                className={fieldClass}
                value={value}
                disabled={disabled || loading || Boolean(error)}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Туманни танланг</option>
                {(data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
            </select>
            {error && (
                <Button type="button" variant="outline" onClick={retry}>
                    Туманларни қайта юклаш
                </Button>
            )}
        </div>
    );
}

function SchoolPicker({
    districtId, value, onChange, disabled,
}: {
    districtId: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    const { data, loading, error, retry } =
        useApiQuery<SchoolOption[]>(
            `/schools?districtId=${districtId}`,
        );

    return (
        <div className="space-y-2">
            <label htmlFor="access-school">Мактаб</label>
            <select
                id="access-school"
                className={fieldClass}
                value={value}
                disabled={disabled || loading || Boolean(error)}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Мактабни танланг</option>
                {(data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
            </select>
            {error && (
                <Button type="button" variant="outline" onClick={retry}>
                    Мактабларни қайта юклаш
                </Button>
            )}
        </div>
    );
}

export function UserAccessForm({
    user, onUpdated, onCancel,
}: Props) {
    const { session } = useAuth();
    const currentRole = session?.profile.role;
    const currentId = session?.profile.id;

    const [role, setRole] = useState<UserRole>(user.role);
    const [regionId, setRegionId] = useState(
        String(user.region?.id ?? user.scope.regionId ?? ''),
    );
    const [districtId, setDistrictId] = useState(
        String(user.district?.id ?? user.scope.districtId ?? ''),
    );
    const [schoolId, setSchoolId] = useState(
        String(user.scope.schoolId ?? ''),
    );

    const [userScopeType, setUserScopeType] = useState<
        'NONE' | 'REGION' | 'DISTRICT' | 'SCHOOL'
    >(
        user.scope.schoolId ? 'SCHOOL' :
            user.scope.districtId ? 'DISTRICT' :
                user.scope.regionId ? 'REGION' : 'NONE',
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    const { data: regions, loading: regionsLoading,
        error: regionsError, retry: retryRegions } =
        useApiQuery<Option[]>('/regions/options');

    const allowedRoles: UserRole[] =
        currentRole === 'SUPER_ADMIN'
            ? ['USER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN', 'REGION_ADMIN']
            : currentRole === 'REGION_ADMIN'
                ? ['USER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN']
                : currentRole === 'DISTRICT_ADMIN'
                    ? ['USER', 'SCHOOL_ADMIN']
                    : [];

    const editable =
        user.isActive &&
        user.id !== currentId &&
        allowedRoles.length > 0 &&
        (currentRole === 'SUPER_ADMIN' ||
            (currentRole === 'REGION_ADMIN' &&
                !['REGION_ADMIN', 'SUPER_ADMIN'].includes(user.role)) ||
            (currentRole === 'DISTRICT_ADMIN' &&
                ['USER', 'SCHOOL_ADMIN'].includes(user.role)));

    const scopeType =
        role === 'REGION_ADMIN' ? 'REGION' :
            role === 'DISTRICT_ADMIN' ? 'DISTRICT' :
                role === 'SCHOOL_ADMIN' ? 'SCHOOL' :
                    userScopeType;

    const needsRegion = scopeType !== 'NONE';
    const needsDistrict =
        scopeType === 'DISTRICT' || scopeType === 'SCHOOL';
    const needsSchool = scopeType === 'SCHOOL';

    function changeRegion(value: string) {
        setRegionId(value);
        setDistrictId('');
        setSchoolId('');
    }

    function changeDistrict(value: string) {
        setDistrictId(value);
        setSchoolId('');
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current || !editable) return;

        setError('');

        if (!allowedRoles.includes(role)) {
            setError('Ушбу ролни тайинлашга рухсат йўқ.');
            return;
        }

        if (
            (needsRegion && !regionId) ||
            (needsDistrict && !districtId) ||
            (needsSchool && !schoolId)
        ) {
            setError('Ролга мос ҳудудни тўлиқ танланг.');
            return;
        }

        const payload = {
            role,
            regionId: scopeType === 'REGION' ? Number(regionId) : null,
            districtId: scopeType === 'DISTRICT' ? Number(districtId) : null,
            schoolId: scopeType === 'SCHOOL' ? Number(schoolId) : null,
        };

        const unchanged =
            payload.role === user.role &&
            payload.regionId === user.scope.regionId &&
            payload.districtId === user.scope.districtId &&
            payload.schoolId === user.scope.schoolId;

        if (unchanged) {
            setError('Ҳеч қандай ўзгариш киритилмади.');
            return;
        }

        submitting.current = true;
        setBusy(true);

        try {
            await authorizedPatch(`/users/${user.id}/access`, payload);
            onUpdated();
        } catch (err: unknown) {
            setError(err instanceof Error
                ? err.message
                : 'Ваколатни сақлашда хатолик юз берди.');
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    if (!editable) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Ушбу фойдаланувчининг ваколатини ўзгартиришга
                    рухсат йўқ ёки ҳисоб фаол эмас.
                </p>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Ёпиш
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Фойдаланувчи: <strong>{user.login}</strong>
            </p>

            <div className="space-y-2">
                <label htmlFor="access-role">Рол</label>
                <select
                    id="access-role"
                    className={fieldClass}
                    value={role}
                    disabled={busy}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                >
                    {allowedRoles.map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
            </div>

            {role === 'USER' && (
                <div className="space-y-2">
                    <label htmlFor="access-scope-type">Оддий фойдаланувчи ҳудуди</label>
                    <select
                        id="access-scope-type"
                        className={fieldClass}
                        value={userScopeType}
                        disabled={busy}
                        onChange={(e) => {
                            setUserScopeType(e.target.value as typeof userScopeType);
                            setRegionId('');
                            setDistrictId('');
                            setSchoolId('');
                        }}
                    >
                        <option value="NONE">Ҳудудсиз</option>
                        <option value="REGION">Вилоят</option>
                        <option value="DISTRICT">Туман / шаҳар</option>
                        <option value="SCHOOL">Мактаб</option>
                    </select>
                </div>
            )}

            {needsRegion && (
                <div className="space-y-2">
                    <label htmlFor="access-region">Вилоят</label>
                    <select
                        id="access-region"
                        className={fieldClass}
                        value={regionId}
                        disabled={busy || regionsLoading || Boolean(regionsError)}
                        onChange={(e) => changeRegion(e.target.value)}
                    >
                        <option value="">Вилоятни танланг</option>
                        {(regions ?? []).map((region) => (
                            <option key={region.id} value={region.id}>
                                {region.name}
                            </option>
                        ))}
                    </select>
                    {regionsError && (
                        <Button type="button" variant="outline" onClick={retryRegions}>
                            Вилоятларни қайта юклаш
                        </Button>
                    )}
                </div>
            )}

            {needsDistrict && regionId && (
                <DistrictPicker
                    key={regionId}
                    regionId={regionId}
                    value={districtId}
                    disabled={busy}
                    onChange={changeDistrict}
                />
            )}

            {needsSchool && districtId && (
                <SchoolPicker
                    key={districtId}
                    districtId={districtId}
                    value={schoolId}
                    disabled={busy}
                    onChange={setSchoolId}
                />
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline"
                    disabled={busy} onClick={onCancel}>
                    Бекор қилиш
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? 'Сақланмоқда...' : 'Ваколатни сақлаш'}
                </Button>
            </div>
        </form>
    );
}
