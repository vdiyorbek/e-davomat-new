
import { useRef, useState } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { authorizedPatch } from '@/lib/auth-session';
import { ApiError } from '@/lib/api';
import type { UserRole } from '@/types/auth';

interface StatusUser {
    id: number;
    login: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
}

interface Props {
    user: StatusUser;
    currentUserId: number;
    onUpdated: (message: string) => void;
}

export function UserStatusAction({
    user,
    currentUserId,
    onUpdated,
}: Props) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);

    const protectedUser =
        user.id === currentUserId ||
        user.role === 'SUPER_ADMIN';

    async function changeStatus() {
        if (submitting.current || protectedUser) return;

        submitting.current = true;
        setBusy(true);
        setError('');

        const nextActive = !user.isActive;

        try {
            await authorizedPatch(
                `/users/${user.id}`,
                { isActive: nextActive },
            );

            setConfirming(false);
            onUpdated(
                nextActive
                    ? 'Фойдаланувчи қайта фаоллаштирилди.'
                    : 'Фойдаланувчи блокланди.',
            );
        } catch (err: unknown) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Ҳолатни ўзгартиришда хатолик юз берди.',
            );
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    if (protectedUser) {
        return null;
    }

    return (
        <div className="space-y-2">
            {!confirming ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirming(true)}
                    className={
                        user.isActive
                            ? 'text-destructive'
                            : ''
                    }
                >
                    {user.isActive ? (
                        <>
                            <Ban className="mr-2 size-4" />
                            Блоклаш
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="mr-2 size-4" />
                            Фаоллаштириш
                        </>
                    )}
                </Button>
            ) : (
                <div className="max-w-sm space-y-3 rounded-xl border bg-card p-3">
                    <p className="text-sm font-medium">
                        {user.fullName || user.login}
                    </p>

                    <p className="text-xs text-muted-foreground">
                        {user.isActive
                            ? 'Ушбу аккаунт блоклансинми? Фаол сессиялари бекор қилинади.'
                            : 'Ушбу аккаунт қайта фаоллаштирилсинми?'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirming(false)}
                        >
                            Бекор қилиш
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void changeStatus()}
                        >
                            {busy ? 'Бажарилмоқда...' : 'Тасдиқлаш'}
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
