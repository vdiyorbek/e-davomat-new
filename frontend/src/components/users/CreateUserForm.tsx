import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { authorizedPost } from '@/lib/auth-session';

import { UserNameFields } from './UserNameFields';

interface CreatedUser {
    id: number;
    personId: number;
    login: string;
    role: string;
    isActive: boolean;
}

interface CreateUserFormProps {
    onCreated: (user: CreatedUser) => void;
    onCancel: () => void;
}

export function CreateUserForm({ onCreated, onCancel }: CreateUserFormProps) {
    const { t } = useTranslation();
    const id = useId();
    const [names, setNames] = useState({ lastName: '', firstName: '', middleName: '' });
    const [login, setLogin] = useState('');
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
        if (!/^[a-z0-9._]{3,50}$/.test(normalizedLogin)) return setError(t('users.errors.login'));
        if (password.length < 12 || password.length > 128) return setError(t('users.errors.password'));
        if (password !== confirmPassword) return setError(t('users.errors.passwordMismatch'));

        submitting.current = true;
        setBusy(true);
        try {
            const created = await authorizedPost<CreatedUser>('/users', {
                firstName: names.firstName.trim(),
                lastName: names.lastName.trim(),
                middleName: names.middleName.trim() || undefined,
                login: normalizedLogin,
                password,
            });
            setPassword('');
            setConfirmPassword('');
            onCreated(created);
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
        <form onSubmit={handleSubmit} className="space-y-5">
            <UserNameFields {...names} disabled={busy} onChange={(field, value) => setNames((previous) => ({ ...previous, [field]: value }))} />

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
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={busy}
                    />
                </Field>
            </div>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('users.create')}
                </Button>
            </div>
        </form>
    );
}
