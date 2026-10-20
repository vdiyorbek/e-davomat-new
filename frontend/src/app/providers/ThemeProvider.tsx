import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './theme-context';
import type { Theme } from './theme-context';

const STORAGE_KEY = 'edavomat-theme';

function readStoredTheme(): Theme {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value === 'light' || value === 'dark' || value === 'system') return value;
    } catch {
        /* storage mavjud emas */
    }
    // Standart holat — qorong‘i mavzu (eski E-davomat tizimi kabi).
    return 'dark';
}

function systemPrefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(readStoredTheme);
    const [systemDark, setSystemDark] = useState(systemPrefersDark);

    useEffect(() => {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => setSystemDark(query.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    const resolved: 'light' | 'dark' =
        theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', resolved === 'dark');
        root.style.colorScheme = resolved;
    }, [resolved]);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* storage mavjud emas */
        }
    }, []);

    const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
