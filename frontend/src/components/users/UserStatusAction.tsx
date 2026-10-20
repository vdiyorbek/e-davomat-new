import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiError } from '@/lib/api';
import { authorizedPatch } from '@/lib/auth-session';
import type { UserRole } from '@/types/auth';

export interface StatusUser {
    id: number;
    login: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
}

interface Props {
    user: StatusUser | null;
    onClose: () => void;
    onUpdated: (message: string) => void;
}

/** Foydalanuvchini bloklash yoki qayta faollashtirishni tasdiqlash oynasi. */
export function UserStatusDialog({ user, onClose, onUpdated }: Props) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    async function changeStatus() {
        if (!user || submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        const nextActive = !user.isActive;
        try {
            await authorizedPatch(`/users/${user.id}`, { isActive: nextActive });
            onUpdated(nextActive ? t('users.status.activated') : t('users.status.blocked'));
            onClose();
        } catch (err: unknown) {
            setError(err instanceof ApiError ? err.message : t('users.status.failed'));
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <AlertDialog
            open={user !== null}
            onOpenChange={(open) => {
                if (!open && !busy) {
                    setError('');
                    onClose();
                }
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {user?.isActive ? t('users.status.blockTitle') : t('users.status.activateTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        <strong className="text-foreground">{user?.fullName || user?.login}</strong>
                        <br />
                        {user?.isActive ? t('users.status.blockText') : t('users.status.activateText')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        variant={user?.isActive ? 'destructive' : 'default'}
                        disabled={busy}
                        onClick={(event) => {
                            event.preventDefault();
                            void changeStatus();
                        }}
                    >
                        {busy ? t('common.saving') : user?.isActive ? t('users.status.block') : t('users.status.activate')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
