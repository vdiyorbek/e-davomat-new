import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export function LogoutButton() {
    const { t } = useTranslation();
    const { logout } = useAuth();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleLogout() {
        if (busy) return;

        setBusy(true);
        setError('');

        try {
            await logout();
        } catch (error: unknown) {
            setError(
                error instanceof ApiError
                    ? error.message
                    : t('common.signOutFailed'),
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <Button
                variant="outline"
                disabled={busy}
                onClick={() => void handleLogout()}
            >
                {busy ? t('common.signingOut') : t('common.signOut')}
            </Button>

            {error && (
                <p
                    role="alert"
                    className="max-w-xs text-right text-xs text-red-500"
                >
                    {error}
                </p>
            )}
        </div>
    );
}