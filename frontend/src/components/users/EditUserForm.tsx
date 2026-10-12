
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPatch } from '@/lib/auth-session';
import { ApiError } from '@/lib/api';

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

export function EditUserForm({
    user,
    onUpdated,
    onCancel,
}: EditUserFormProps) {
    const [firstName, setFirstName] = useState(
        user.firstName ?? '',
    );
    const [lastName, setLastName] = useState(
        user.lastName ?? '',
    );
    const [middleName, setMiddleName] = useState(
        user.middleName ?? '',
    );
    const [login, setLogin] = useState(user.login);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] =
        useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();
        if (submitting.current) return;

        setError('');

        const normalizedLogin = login.trim().toLowerCase();
        const normalizedFirstName = firstName.trim();
        const normalizedLastName = lastName.trim();
        const normalizedMiddleName = middleName.trim();

        if (
            normalizedFirstName.length < 2 ||
            normalizedLastName.length < 2
        ) {
            setError('Ism va familiya kamida 2 belgidan iborat bo‘lsin.');
            return;
        }

        if (!/^[a-z0-9._]{3,50}$/.test(normalizedLogin)) {
            setError('Login formatini tekshiring.');
            return;
        }

        if (password && (password.length < 12 || password.length > 128)) {
            setError('Yangi parol 12–128 belgidan iborat bo‘lishi kerak.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Parollar bir-biriga mos kelmadi.');
            return;
        }

        const changes: Record<string, string> = {};

        if (normalizedFirstName !== (user.firstName ?? '')) {
            changes.firstName = normalizedFirstName;
        }

        if (normalizedLastName !== (user.lastName ?? '')) {
            changes.lastName = normalizedLastName;
        }

        if (normalizedMiddleName !== (user.middleName ?? '')) {
            if (normalizedMiddleName) {
                changes.middleName = normalizedMiddleName;
            } else {
                setError(
                    'Otasining ismini tozalash uchun backendda null qo‘llab-quvvatlanishi kerak.',
                );
                return;
            }
        }

        if (normalizedLogin !== user.login) {
            changes.login = normalizedLogin;
        }

        if (password) {
            changes.password = password;
        }

        if (Object.keys(changes).length === 0) {
            setError('Hech qanday o‘zgarish kiritilmadi.');
            return;
        }

        submitting.current = true;
        setBusy(true);

        try {
            await authorizedPatch(
                `/users/${user.id}`,
                changes,
            );
            onUpdated();
        } catch (err: unknown) {
            if (
                err instanceof ApiError &&
                (err.status === 0 || err.status >= 500)
            ) {
                setError(
                    'Natija tasdiqlanmadi. Qayta yuborishdan oldin ro‘yxatni tekshiring.',
                );
            } else {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Tahrirlashda xatolik yuz berdi.',
                );
            }
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="edit-last-name">Familiya</label>
                    <Input
                        id="edit-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        required
                        disabled={busy}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="edit-first-name">Ism</label>
                    <Input
                        id="edit-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        required
                        disabled={busy}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="edit-middle-name">Otasining ismi</label>
                <Input
                    id="edit-middle-name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    maxLength={100}
                    disabled={busy}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="edit-login">Login</label>
                <Input
                    id="edit-login"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    maxLength={50}
                    required
                    disabled={busy}
                />
            </div>

            <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">
                    Parolni almashtirish
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                    Parol o‘zgarmasa, quyidagi maydonlarni bo‘sh qoldiring.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="edit-password">Yangi parol</label>
                        <Input
                            id="edit-password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="edit-confirm-password">
                            Parolni tasdiqlash
                        </label>
                        <Input
                            id="edit-confirm-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={busy}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={busy}
                >
                    Bekor qilish
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda...' : 'O‘zgarishlarni saqlash'}
                </Button>
            </div>
        </form>
    );
}
