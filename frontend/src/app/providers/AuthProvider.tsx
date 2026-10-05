import {
    useEffect,
    useMemo,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

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
                className="flex min-h-svh items-center justify-center bg-[#0c1222] px-6 text-white"
                aria-busy="true"
            >
                <p role="status" className="text-sm text-slate-300">
                    Sessiya tekshirilmoqda…
                </p>
            </main>
        );
    }

    if (state.status === 'error') {
        return (
            <main className="flex min-h-svh items-center justify-center bg-[#0c1222] px-6 text-white">
                <div className="w-full max-w-md rounded-2xl border border-[#253153] bg-[#151e36] p-8 text-center">
                    <h1 className="text-xl font-semibold">
                        Sessiyani tekshirib bo‘lmadi
                    </h1>

                    <p
                        role="alert"
                        className="mt-3 text-sm leading-6 text-slate-300"
                    >
                        {state.error}
                    </p>

                    <Button
                        className="mt-6"
                        onClick={() => void restoreSession()}
                    >
                        Qayta urinish
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