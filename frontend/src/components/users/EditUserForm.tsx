import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ApiError } from '@/lib/api';
import { authorizedPatch } from '@/lib/auth-session';

import { UserNameFields } from './UserNameFields';

export interface EditableUser {
    id: number;
    login: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
}

interface EditUserFormProps {
    user: EditableUser;
    onUpdated: () => void;
    onCancel: () => void;
}

export function EditUserForm({ user, onUpdated, onCancel }: EditUserFormProps) {
    const { t } = useTranslation();
    const id = useId();
    const [names, setNames] = useState({
        lastName: user.lastName ?? '',
        firstName: user.firstName ?? '',
        middleName: user.middleName ?? '',
    });
    const [login, setLogin] = useState(user.login);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current) return;
        setError('');

        const normalizedLogin = login.trim().toLowerCase();
        const firstName = names.firstName.trim();
        const lastName = names.lastName.trim();
        const middleName = names.middleName.trim();

        if (firstName.length < 2 || lastName.length < 2) return setError(t('users.errors.nameLength'));
        if (!/^[a-z0-9._]{3,50}$/.test(normalizedLogin)) return setError(t('users.errors.login'));
        if (password && (password.length < 12 || password.length > 128)) return setError(t('users.errors.password'));
        if (password !== confirmPassword) return setError(t('users.errors.passwordMismatch'));

        const changes: Record<string, string> = {};
        if (firstName !== (user.firstName ?? '')) changes.firstName = firstName;
        if (lastName !== (user.lastName ?? '')) changes.lastName = lastName;
        if (middleName !== (user.middleName ?? '')) {
            if (!middleName) return setError(t('users.errors.middleNameClear'));
            changes.middleName = middleName;
        }
        if (normalizedLogin !== user.login) changes.login = normalizedLogin;
        if (password) changes.password = password;
        if (Object.keys(changes).length === 0) return setError(t('users.errors.noChanges'));

        submitting.current = true;
        setBusy(true);
        try {
            await authorizedPatch(`/users/${user.id}`, changes);
            onUpdated();
        } catch (err: unknown) {
            if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
                setError(t('users.errors.uncertain'));
            } else {
                setError(err instanceof Error ? err.message : t('users.errors.updateFailed'));
            }
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <UserNameFields {...names} disabled={busy} onChange={(field, value) => setNames((previous) => ({ ...previous, [field]: value }))} />

            <Field htmlFor={`${id}-login`} label={t('profile.login')} hint={t('users.loginHint')} required>
                <Input
                    id={`${id}-login`}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={50}
                    required
                    disabled={busy}
                />
            </Field>

            <Separator />

            <div className="space-y-4">
                <div>
                    <p className="text-sm font-semibold">{t('users.changePassword')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('users.changePasswordHint')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-password`} label={t('users.newPassword')}>
                        <Input
                            id={`${id}-password`}
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            disabled={busy}
                        />
                    </Field>
                    <Field htmlFor={`${id}-confirm`} label={t('users.confirmPassword')}>
                        <Input
                            id={`${id}-confirm`}
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            disabled={busy}
                        />
                    </Field>
                </div>
            </div>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('users.saveChanges')}
                </Button>
            </div>
        </form>
    );
}
