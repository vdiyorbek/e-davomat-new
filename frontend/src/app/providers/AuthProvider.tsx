import {
    useEffect,
    useMemo,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    getAuthSnapshot,
    refreshOnFocus,
    restoreSession,
    signIn,
    signOut,
    subscribeAuth,
} from '@/lib/auth-session';

import { AuthContext } from './auth-context';

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { t } = useTranslation();
    const state = useSyncExternalStore(
        subscribeAuth,
        getAuthSnapshot,
    );

    useEffect(() => {
        void restoreSession();

        function handleFocus() {
            // Vaqtinchalik tarmoq xatosi sessiyani o‘chirmaydi.
            void refreshOnFocus().catch(() => undefined);
        }

        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const value = useMemo(
        () => ({
            session: state.session,
            notice: state.notice,
            signIn,
            logout: signOut,
        }),
        [state.session, state.notice],
    );

    if (state.status === 'loading') {
        return (
            <main
                className="paper flex min-h-svh items-center justify-center px-6 text-foreground"
                aria-busy="true"
            >
                <p role="status" className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
                    <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" />
                    {t('common.session.checking')}
                </p>
            </main>
        );
    }

    if (state.status === 'error') {
        return (
            <main className="paper flex min-h-svh items-center justify-center px-6 text-foreground">
                <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
                    <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                        <AlertTriangle aria-hidden="true" className="size-6" />
                    </span>
                    <h1 className="text-xl font-semibold">
                        {t('common.session.checkFailed')}
                    </h1>

                    <p
                        role="alert"
                        className="mt-3 text-sm leading-6 text-muted-foreground"
                    >
                        {state.error}
                    </p>

                    <Button
                        className="mt-6"
                        onClick={() => void restoreSession()}
                    >
                        {t('common.retry')}
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}