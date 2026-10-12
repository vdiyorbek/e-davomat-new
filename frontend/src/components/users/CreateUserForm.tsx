
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';
import { ApiError } from '@/lib/api';

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

export function CreateUserForm({
    onCreated,
    onCancel,
}: CreateUserFormProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

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


        if (!/^[a-z0-9._]{3,50}$/.test(normalizedLogin)) {
            setError('Login 3–50 belgidan iborat bo‘lsin.');
            return;
        }

        if (password.length < 12 || password.length > 128) {
            setError('Parol 12–128 belgidan iborat bo‘lishi kerak.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Parollar bir-biriga mos kelmadi.');
            return;
        }

        submitting.current = true;
        setBusy(true);

        try {
            const created = await authorizedPost<CreatedUser>(
                '/users',
                {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    middleName: middleName.trim() || undefined,
                    login: normalizedLogin,
                    password,
                }
            );

            setPassword('');
            setConfirmPassword('');
            onCreated(created);
        } catch (err: unknown) {
            if (
                err instanceof ApiError &&
                (err.status === 0 || err.status >= 500)
            ) {
                setError(
                    'Server javobini tasdiqlab bo‘lmadi. ' +
                    'Qayta yuborishdan oldin foydalanuvchilar ' +
                    'ro‘yxatini tekshiring.',
                );
            } else {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Foydalanuvchi yaratishda xatolik yuz berdi.',
                );
            }
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="user-last-name">Familiya</label>
                    <Input
                        id="user-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        required
                        disabled={busy}
                        placeholder="Valiyev"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="user-first-name">Ism</label>
                    <Input
                        id="user-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        required
                        disabled={busy}
                        placeholder="Ali"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="user-middle-name">Otasining ismi</label>
                <Input
                    id="user-middle-name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    maxLength={100}
                    disabled={busy}
                    placeholder="Karimovich"
                />
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="user-login"
                    className="text-sm font-medium"
                >
                    Login
                </label>

                <Input
                    id="user-login"
                    value={login}
                    onChange={(event) =>
                        setLogin(event.target.value)
                    }
                    placeholder="Masalan: school.admin"
                    autoComplete="off"
                    maxLength={50}
                    required
                    disabled={busy}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <label
                        htmlFor="user-password"
                        className="text-sm font-medium"
                    >
                        Parol
                    </label>

                    <Input
                        id="user-password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                        disabled={busy}
                    />
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor="user-confirm-password"
                        className="text-sm font-medium"
                    >
                        Parolni tasdiqlash
                    </label>

                    <Input
                        id="user-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                            setConfirmPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        required
                        disabled={busy}
                    />
                </div>
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
                >
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
                    {busy ? 'Saqlanmoqda...' : 'Foydalanuvchi yaratish'}
                </Button>
            </div>
        </form>
    );
}
