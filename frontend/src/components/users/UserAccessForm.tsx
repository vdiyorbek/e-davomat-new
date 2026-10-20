import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPatch } from '@/lib/auth-session';
import type { UserRole } from '@/types/auth';

interface Option {
    id: number;
    name: string;
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

type ScopeKind = 'NONE' | 'REGION' | 'DISTRICT' | 'SCHOOL';

function OptionsPicker({
    path,
    label,
    placeholder,
    value,
    onChange,
    disabled,
    searchable,
}: {
    path: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    searchable?: boolean;
}) {
    const { t } = useTranslation();
    const id = useId();
    const { data, loading, error, retry } = useApiQuery<Option[]>(path);

    return (
        <Field htmlFor={id} label={label} required error={error || undefined}>
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                disabled={disabled || loading || Boolean(error)}
                placeholder={loading ? t('common.loading') : placeholder}
                searchable={searchable}
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

export function UserAccessForm({ user, onUpdated, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const currentRole = session?.profile.role;
    const currentId = session?.profile.id;

    const [role, setRole] = useState<UserRole>(user.role);
    const [regionId, setRegionId] = useState(String(user.region?.id ?? user.scope.regionId ?? ''));
    const [districtId, setDistrictId] = useState(String(user.district?.id ?? user.scope.districtId ?? ''));
    const [schoolId, setSchoolId] = useState(String(user.scope.schoolId ?? ''));
    const [userScopeType, setUserScopeType] = useState<ScopeKind>(
        user.scope.schoolId ? 'SCHOOL' : user.scope.districtId ? 'DISTRICT' : user.scope.regionId ? 'REGION' : 'NONE',
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

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
            (currentRole === 'REGION_ADMIN' && !['REGION_ADMIN', 'SUPER_ADMIN'].includes(user.role)) ||
            (currentRole === 'DISTRICT_ADMIN' && ['USER', 'SCHOOL_ADMIN'].includes(user.role)));

    const scopeType: ScopeKind =
        role === 'REGION_ADMIN' ? 'REGION' : role === 'DISTRICT_ADMIN' ? 'DISTRICT' : role === 'SCHOOL_ADMIN' ? 'SCHOOL' : userScopeType;

    const needsRegion = scopeType !== 'NONE';
    const needsDistrict = scopeType === 'DISTRICT' || scopeType === 'SCHOOL';
    const needsSchool = scopeType === 'SCHOOL';

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current || !editable) return;
        setError('');

        if (!allowedRoles.includes(role)) return setError(t('users.access.errors.roleNotAllowed'));
        if ((needsRegion && !regionId) || (needsDistrict && !districtId) || (needsSchool && !schoolId)) {
            return setError(t('users.access.errors.scope'));
        }

        const payload = {
            role,
            regionId: scopeType === 'REGION' ? Number(regionId) : null,
            districtId: scopeType === 'DISTRICT' ? Number(districtId) : null,
            schoolId: scopeType === 'SCHOOL' ? Number(schoolId) : null,
        };

        if (
            payload.role === user.role &&
            payload.regionId === user.scope.regionId &&
            payload.districtId === user.scope.districtId &&
            payload.schoolId === user.scope.schoolId
        ) {
            return setError(t('users.errors.noChanges'));
        }

        submitting.current = true;
        setBusy(true);
        try {
            await authorizedPatch(`/users/${user.id}/access`, payload);
            onUpdated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('users.access.errors.saveFailed'));
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    if (!editable) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('users.access.notAllowed')}</p>
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.close')}
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                {t('users.access.user')}: <strong>@{user.login}</strong>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-role`} label={t('users.role')} required>
                    <SelectField
                        id={`${id}-role`}
                        value={role}
                        disabled={busy}
                        onValueChange={(value) => setRole(value as UserRole)}
                        options={allowedRoles.map((value) => ({ value, label: t(`roles.${value}`) }))}
                    />
                </Field>

                {role === 'USER' && (
                    <Field htmlFor={`${id}-scope`} label={t('users.access.userScope')}>
                        <SelectField
                            id={`${id}-scope`}
                            value={userScopeType}
                            disabled={busy}
                            onValueChange={(value) => {
                                setUserScopeType(value as ScopeKind);
                                setRegionId('');
                                setDistrictId('');
                                setSchoolId('');
                            }}
                            options={(['NONE', 'REGION', 'DISTRICT', 'SCHOOL'] as const).map((value) => ({
                                value,
                                label: t(`users.access.scopes.${value}`),
                            }))}
                        />
                    </Field>
                )}
            </div>

            {needsRegion && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <OptionsPicker
                        path="/regions/options"
                        label={t('common.region')}
                        placeholder={t('persons.chooseRegion')}
                        value={regionId}
                        disabled={busy}
                        onChange={(value) => {
                            setRegionId(value);
                            setDistrictId('');
                            setSchoolId('');
                        }}
                    />
                    {needsDistrict && regionId && (
                        <OptionsPicker
                            key={regionId}
                            path={`/districts/options?regionId=${regionId}`}
                            label={t('common.district')}
                            placeholder={t('persons.chooseDistrict')}
                            value={districtId}
                            disabled={busy}
                            onChange={(value) => {
                                setDistrictId(value);
                                setSchoolId('');
                            }}
                        />
                    )}
                    {needsSchool && districtId && (
                        <OptionsPicker
                            key={districtId}
                            path={`/schools?districtId=${districtId}`}
                            label={t('common.school')}
                            placeholder={t('members.chooseSchool')}
                            value={schoolId}
                            disabled={busy}
                            onChange={setSchoolId}
                            searchable
                        />
                    )}
                </div>
            )}

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('users.access.save')}
                </Button>
            </div>
        </form>
    );
}
