
import { useState } from 'react';

import { Field } from '@/components/common/Field';
import {
    ErrorState,
    LoadingState,
} from '@/components/common/states';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { personFullName } from '@/lib/person';

import type { SchoolMembership } from
    '@/types/school-membership';

interface MemberAccountStatus {
    membershipId: number;
    hasAccount: boolean;
    user: {
        id: number;
        login: string;
        role: 'STUDENT' | 'TEACHER' | 'USER';
        isActive: boolean;
    } | null;
}

const LOGIN_PATTERN = /^[a-z0-9._]{3,50}$/;

export function MemberAccountForm({
    membership,
    onCancel,
    onSaved,
}: {
    membership: SchoolMembership;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const path =
        `/member-accounts/membership/${membership.id}`;

    const query = useApiQuery<MemberAccountStatus>(path);

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] =
        useState('');

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const fullName = membership.person
        ? personFullName(membership.person)
        : 'Shaxs ma’lumoti mavjud emas';

    const targetRole =
        membership.type === 'TEACHER'
            ? 'O‘qituvchi'
            : 'O‘quvchi';

    async function save() {
        if (
            saving ||
            !query.data ||
            query.data.hasAccount
        ) {
            return;
        }

        setSaveError('');

        const normalizedLogin = login.trim().toLowerCase();

        if (!LOGIN_PATTERN.test(normalizedLogin)) {
            setSaveError(
                'Login 3–50 ta kichik lotin harfi, raqam, nuqta yoki pastki chiziqdan iborat bo‘lishi kerak.',
            );
            return;
        }

        if (
            password.length < 12 ||
            password.length > 128
        ) {
            setSaveError(
                'Parol 12–128 ta belgidan iborat bo‘lishi kerak.',
            );
            return;
        }

        if (password !== confirmPassword) {
            setSaveError(
                'Parollar bir-biriga mos emas.',
            );
            return;
        }

        setSaving(true);

        try {
            await authorizedPost(
                '/member-accounts',
                {
                    membershipId: membership.id,
                    login: normalizedLogin,
                    password,
                },
            );

            setPassword('');
            setConfirmPassword('');

            onSaved();
        } catch (error: unknown) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : 'Akkaunt yaratishda xatolik yuz berdi.',
            );

            // Masalan, boshqa administrator shu vaqtda
            // akkaunt yaratib qo‘ygan bo‘lishi mumkin.
            query.retry();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold">{fullName}</p>

                <p className="mt-1 text-sm text-muted-foreground">
                    {membership.school.name}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                    Akkaunt turi: {targetRole}
                </p>
            </div>

            {query.loading && (
                <LoadingState rows={3} />
            )}

            {query.error && (
                <ErrorState
                    message={query.error}
                    onRetry={query.retry}
                />
            )}

            {!query.loading &&
                !query.error &&
                query.data?.hasAccount && (
                    <div className="space-y-4">
                        <div className="rounded-xl border p-4">
                            <p className="font-semibold">
                                Ushbu shaxs uchun akkaunt mavjud
                            </p>

                            <div className="mt-3 space-y-2 text-sm">
                                <p>
                                    <span className="text-muted-foreground">
                                        Login:
                                    </span>{' '}
                                    {query.data.user?.login ?? '—'}
                                </p>

                                <p>
                                    <span className="text-muted-foreground">
                                        Rol:
                                    </span>{' '}
                                    {query.data.user?.role ?? '—'}
                                </p>

                                <p>
                                    <span className="text-muted-foreground">
                                        Holat:
                                    </span>{' '}
                                    {query.data.user?.isActive
                                        ? 'Faol'
                                        : 'Bloklangan'}
                                </p>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            className="w-full"
                        >
                            Yopish
                        </Button>
                    </div>
                )}

            {!query.loading &&
                !query.error &&
                query.data &&
                !query.data.hasAccount && (
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save();
                        }}
                    >
                        <Field
                            htmlFor="member-account-login"
                            label="Login"
                            hint="3–50 ta belgi: a–z, 0–9, nuqta va pastki chiziq"
                            required
                        >
                            <Input
                                id="member-account-login"
                                value={login}
                                onChange={(event) =>
                                    setLogin(event.target.value.toLowerCase())
                                }
                                placeholder="student.demo"
                                autoComplete="off"
                                maxLength={50}
                                disabled={saving}
                                required
                            />
                        </Field>

                        <Field
                            htmlFor="member-account-password"
                            label="Boshlang‘ich parol"
                            hint="Kamida 12 ta belgi. JSHSHIR yoki tug‘ilgan sanadan foydalanmang."
                            required
                        >
                            <Input
                                id="member-account-password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                                disabled={saving}
                                required
                            />
                        </Field>

                        <Field
                            htmlFor="member-account-confirm"
                            label="Parolni tasdiqlash"
                            required
                        >
                            <Input
                                id="member-account-confirm"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) =>
                                    setConfirmPassword(event.target.value)
                                }
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                                disabled={saving}
                                required
                            />
                        </Field>

                        <p className="text-xs text-muted-foreground">
                            Akkauntning STUDENT yoki TEACHER roli
                            backend tomonidan maktab a’zoligi
                            asosida belgilanadi.
                        </p>

                        {saveError && (
                            <ErrorState message={saveError} />
                        )}

                        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={saving}
                            >
                                Bekor qilish
                            </Button>

                            <Button
                                type="submit"
                                disabled={saving}
                            >
                                {saving
                                    ? 'Yaratilmoqda...'
                                    : 'Akkaunt yaratish'}
                            </Button>
                        </div>
                    </form>
                )}
        </div>
    );
}
