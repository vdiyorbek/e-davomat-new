import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';

const MIN = 12;
const MAX = 128;

function PasswordInput({
    id,
    value,
    onChange,
    disabled,
    autoComplete,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    autoComplete: string;
}) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Input
                id={id}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                autoComplete={autoComplete}
                maxLength={MAX}
                disabled={disabled}
                required
                className="pr-12"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
                onClick={() => setVisible((current) => !current)}
            >
                {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
        </div>
    );
}

/** Foydalanuvchi o‘z parolini almashtiradi: joriy parol + yangi parol (kamida 12 belgi). */
export function ChangePasswordForm({ onChanged }: { onChanged: () => void | Promise<void> }) {
    const { t } = useTranslation();
    const id = useId();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setError('');

        if (next.length < MIN || next.length > MAX) return setError(t('profile.security.errors.short'));
        if (next !== confirm) return setError(t('profile.security.errors.mismatch'));
        if (next === current) return setError(t('profile.security.errors.same'));

        setSaving(true);
        try {
            await authorizedPost<void>('/me/password', { currentPassword: current, newPassword: next });
            setCurrent('');
            setNext('');
            setConfirm('');
            await onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('profile.security.errors.failed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <Field htmlFor={`${id}-current`} label={t('profile.security.current')} required>
                    <PasswordInput id={`${id}-current`} value={current} onChange={setCurrent} disabled={saving} autoComplete="current-password" />
                </Field>
                <Field htmlFor={`${id}-new`} label={t('profile.security.new')} hint={t('profile.security.hint')} required>
                    <PasswordInput id={`${id}-new`} value={next} onChange={setNext} disabled={saving} autoComplete="new-password" />
                </Field>
                <Field htmlFor={`${id}-confirm`} label={t('profile.security.confirm')} required>
                    <PasswordInput id={`${id}-confirm`} value={confirm} onChange={setConfirm} disabled={saving} autoComplete="new-password" />
                </Field>
            </div>

            {error && <ErrorState message={error} />}

            <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={saving || !current || !next || !confirm}>
                    {saving ? t('profile.security.saving') : t('profile.security.submit')}
                </Button>
            </div>
        </form>
    );
}
