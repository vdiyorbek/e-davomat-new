
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
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
        : t('memberDetails.account.personMissing');

    const targetRole =
        membership.type === 'TEACHER'
            ? t('roles.TEACHER')
            : t('roles.STUDENT');

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
                t('memberDetails.account.loginInvalid'),
            );
            return;
        }

        if (
            password.length < 12 ||
            password.length > 128
        ) {
            setSaveError(
                t('memberDetails.account.passwordLength'),
            );
            return;
        }

        if (password !== confirmPassword) {
            setSaveError(
                t('memberDetails.account.passwordMismatch'),
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
                    : t('memberDetails.account.createFailed'),
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
                    {t('memberDetails.account.type', { role: targetRole })}
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
                                {t('memberDetails.account.exists')}
                            </p>

                            <div className="mt-3 space-y-2 text-sm">
                                <p>
                                    <span className="text-muted-foreground">
                                        {t('memberDetails.account.login')}:
                                    </span>{' '}
                                    {query.data.user?.login ?? '—'}
                                </p>

                                <p>
                                    <span className="text-muted-foreground">
                                        {t('memberDetails.account.role')}:
                                    </span>{' '}
                                    {query.data.user?.role ? t(`roles.${query.data.user.role}`) : '—'}
                                </p>

                                <p>
                                    <span className="text-muted-foreground">
                                        {t('memberDetails.account.status')}:
                                    </span>{' '}
                                    {query.data.user?.isActive
                                        ? t('memberDetails.account.active')
                                        : t('memberDetails.account.blocked')}
                                </p>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            className="w-full"
                        >
                            {t('common.close')}
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
                            label={t('memberDetails.account.login')}
                            hint={t('memberDetails.account.loginHint')}
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
                            label={t('memberDetails.account.password')}
                            hint={t('memberDetails.account.passwordHint')}
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
                            label={t('memberDetails.account.confirm')}
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
                            {t('memberDetails.account.roleNote')}
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
                                {t('common.cancel')}
                            </Button>

                            <Button
                                type="submit"
                                disabled={saving}
                            >
                                {saving
                                    ? t('memberDetails.account.creating')
                                    : t('memberDetails.account.create')}
                            </Button>
                        </div>
                    </form>
                )}
        </div>
    );
}
