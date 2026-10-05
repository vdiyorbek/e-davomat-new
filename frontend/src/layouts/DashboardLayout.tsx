import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function DashboardLayout() {
    const { t } = useTranslation();
    const location = useLocation();
    const [menuLocation, setMenuLocation] = useState<string | null>(null);
    const menuOpen = menuLocation === location.key;

    useEffect(() => {
        const query = window.matchMedia('(min-width: 48rem)');
        function closeOnWideScreen() {
            if (query.matches) setMenuLocation(null);
        }
        query.addEventListener('change', closeOnWideScreen);
        return () => query.removeEventListener('change', closeOnWideScreen);
    }, []);

    return (
        <Sheet open={menuOpen} onOpenChange={(open) => setMenuLocation(open ? location.key : null)}>
            <div className="paper min-h-svh text-foreground md:grid md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
                <a href="#main-content" className="sr-only z-[60] rounded-lg bg-background p-3 text-foreground shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
                    {t('common.skipToContent')}
                </a>
                <aside className="sticky top-0 hidden h-dvh min-h-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
                    <Sidebar />
                </aside>
                <div className="flex min-w-0 flex-col">
                    <Header />
                    <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 outline-none sm:p-6 lg:p-8">
                        <Outlet />
                    </main>
                    <footer className="px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
                        {t('brand.platform')}
                    </footer>
                </div>
            </div>
            <SheetContent side="left" className="w-[min(320px,88vw)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetHeader className="sr-only">
                    <SheetTitle>{t('nav.main')}</SheetTitle>
                    <SheetDescription>{t('nav.menuHint')}</SheetDescription>
                </SheetHeader>
                <Sidebar mobile onNavigate={() => setMenuLocation(null)} />
            </SheetContent>
        </Sheet>
    );
}