
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
    const [personId, setPersonId] = useState('');
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

        const id = Number(personId);
        const normalizedLogin = login.trim().toLowerCase();

        if (
            !Number.isInteger(id) ||
            id < 1 ||
            id > 4294967295
        ) {
            setError('Shaxsning ID raqamini to‘g‘ri kiriting.');
            return;
        }

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
                    personId: id,
                    login: normalizedLogin,
                    password,
                },
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
            <div className="space-y-2">
                <label
                    htmlFor="user-person-id"
                    className="text-sm font-medium"
                >
                    Shaxs ID raqami
                </label>

                <Input
                    id="user-person-id"
                    type="number"
                    min={1}
                    step={1}
                    value={personId}
                    onChange={(event) =>
                        setPersonId(event.target.value)
                    }
                    placeholder="Masalan: 5"
                    required
                    disabled={busy}
                />

                <p className="text-xs text-muted-foreground">
                    Tizimda avval ro‘yxatdan o‘tgan shaxsning ID raqami.
                </p>
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
