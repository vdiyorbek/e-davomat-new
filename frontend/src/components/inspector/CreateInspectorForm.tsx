import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { UserNameFields } from '@/components/users/UserNameFields';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { authorizedGet, authorizedPost } from '@/lib/auth-session';

const MAX_MAHALLAS = 30;

interface Option {
    id: number;
    name: string;
}

interface OptionsPage {
    data: Option[];
    totalPages: number;
}

async function loadMahallas(districtId: string, signal: AbortSignal) {
    const all: Option[] = [];
    let page = 1;
    let totalPages: number;
    do {
        const res = await authorizedGet<OptionsPage>(
            `/mahallas/options?districtId=${districtId}&page=${page}&limit=100`,
            signal,
        );
        all.push(...res.data);
        totalPages = res.totalPages;
        page += 1;
    } while (page <= totalPages);
    return all;
}

function OptionsSelect({
    path,
    label,
    placeholder,
    value,
    onChange,
    disabled,
}: {
    path: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    const id = useId();
    const { t } = useTranslation();
    const { data, loading, error } = useApiQuery<Option[]>(path);
    return (
        <Field htmlFor={id} label={label} required error={error || undefined}>
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                disabled={disabled || loading || Boolean(error)}
                placeholder={loading ? t('common.loading') : placeholder}
                searchable
                options={(data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
            />
        </Field>
    );
}

interface Props {
    onCreated: () => void;
    onCancel: () => void;
}

/** Uchastkavoy hisobi + mahallalar — bir qadamda. */
export function CreateInspectorForm({ onCreated, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const role = session?.profile.role;
    const ownRegion = session?.profile.regionId ?? null;
    const ownDistrict = session?.profile.districtId ?? null;

    const [names, setNames] = useState({ lastName: '', firstName: '', middleName: '' });
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [regionId, setRegionId] = useState(ownRegion ? String(ownRegion) : '');
    const [districtId, setDistrictId] = useState(role === 'DISTRICT_ADMIN' && ownDistrict ? String(ownDistrict) : '');
    const [options, setOptions] = useState<Option[]>([]);
    const [loadedFor, setLoadedFor] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    useEffect(() => {
        if (!districtId) return;
        const controller = new AbortController();
        void loadMahallas(districtId, controller.signal)
            .then((all) => {
                if (controller.signal.aborted) return;
                setOptions(all);
                setLoadedFor(districtId);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : t('common.loadFailed'));
                setLoadedFor(districtId);
            });
        return () => controller.abort();
    }, [districtId, t]);

    const optionsLoading = districtId !== '' && loadedFor !== districtId;
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;
    }, [options, search]);

    function toggle(mahallaId: number, checked: boolean) {
        setError('');
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) {
                if (next.size >= MAX_MAHALLAS) {
                    setError(t('inspectors.mahallas.limit', { max: MAX_MAHALLAS }));
                    return prev;
                }
                next.add(mahallaId);
            } else {
                next.delete(mahallaId);
            }
            return next;
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current) return;
        setError('');
        const normalizedLogin = login.trim().toLowerCase();
        if (!districtId) return setError(t('inspectors.manage.errors.district'));
        if (!/^[a-z0-9._]{3,50}$/.test(normalizedLogin)) return setError(t('users.errors.login'));
        if (password.length < 12 || password.length > 128) return setError(t('users.errors.password'));
        if (password !== confirm) return setError(t('users.errors.passwordMismatch'));
        if (selected.size === 0) return setError(t('inspectors.manage.errors.mahallas'));

        submitting.current = true;
        setBusy(true);
        try {
            await authorizedPost('/inspectors', {
                firstName: names.firstName.trim(),
                lastName: names.lastName.trim(),
                middleName: names.middleName.trim() || undefined,
                login: normalizedLogin,
                password,
                districtId: Number(districtId),
                mahallaIds: [...selected],
            });
            setPassword('');
            setConfirm('');
            onCreated();
        } catch (err: unknown) {
            if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
                setError(t('users.errors.uncertain'));
            } else {
                setError(err instanceof Error ? err.message : t('users.errors.createFailed'));
            }
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <UserNameFields
                {...names}
                disabled={busy}
                onChange={(field, value) => setNames((prev) => ({ ...prev, [field]: value }))}
            />

            <Field htmlFor={`${id}-login`} label={t('profile.login')} hint={t('users.loginHint')} required>
                <Input
                    id={`${id}-login`}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder={t('users.loginPlaceholder')}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={50}
                    required
                    disabled={busy}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-password`} label={t('auth.password')} hint={t('users.passwordHint')} required>
                    <Input
                        id={`${id}-password`}
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                        disabled={busy}
                    />
                </Field>
                <Field htmlFor={`${id}-confirm`} label={t('users.confirmPassword')} required>
                    <Input
                        id={`${id}-confirm`}
                        type="password"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={busy}
                    />
                </Field>
            </div>

            {role === 'SUPER_ADMIN' && (
                <OptionsSelect
                    path="/regions/options"
                    label={t('common.region')}
                    placeholder={t('persons.chooseRegion')}
                    value={regionId}
                    disabled={busy}
                    onChange={(value) => {
                        setRegionId(value);
                        setDistrictId('');
                        setOptions([]);
                        setSelected(new Set());
                    }}
                />
            )}
            {role !== 'DISTRICT_ADMIN' && regionId && (
                <OptionsSelect
                    key={regionId}
                    path={`/districts/options?regionId=${regionId}`}
                    label={t('common.district')}
                    placeholder={t('persons.chooseDistrict')}
                    value={districtId}
                    disabled={busy}
                    onChange={(value) => {
                        setDistrictId(value);
                        setOptions([]);
                        setSelected(new Set());
                    }}
                />
            )}

            {districtId && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold">
                        {t('inspectors.manage.mahallas')} <span className="text-destructive">*</span>
                    </p>
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('inspectors.mahallas.search')}
                        aria-label={t('inspectors.mahallas.search')}
                    />
                    {optionsLoading ? (
                        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                    ) : options.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('inspectors.mahallas.empty')}</p>
                    ) : (
                        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
                            {visible.map((item) => (
                                <li key={item.id}>
                                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60">
                                        <Checkbox
                                            checked={selected.has(item.id)}
                                            disabled={busy}
                                            onCheckedChange={(value) => toggle(item.id, value === true)}
                                        />
                                        <span className="min-w-0 [overflow-wrap:anywhere]">{item.name}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {t('inspectors.mahallas.selected', { count: selected.size, max: MAX_MAHALLAS })}
                    </p>
                </div>
            )}

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('inspectors.manage.create')}
                </Button>
            </div>
        </form>
    );
}
