import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { LoadingState } from '@/components/common/states';
import { TooltipProvider } from '@/components/ui/tooltip';

import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar } from './Sidebar';

/**
 * Ilova qobig‘i:
 *  • telefon  (< 768px)  — yuqori sarlavha + pastki navigatsiya paneli + chiquvchi menyu
 *  • planshet (768–1023px) — tor ikonka paneli; menyu tugmasi to‘liq ro‘yxatni ochadi
 *  • kompyuter (≥ 1024px) — to‘liq yon panel
 */
export function DashboardLayout() {
    const { t } = useTranslation();
    const location = useLocation();
    const [menuLocation, setMenuLocation] = useState<string | null>(null);
    const menuOpen = menuLocation === location.key;

    useEffect(() => {
        const query = window.matchMedia('(min-width: 64rem)');
        function closeOnWideScreen() {
            if (query.matches) setMenuLocation(null);
        }
        query.addEventListener('change', closeOnWideScreen);
        return () => query.removeEventListener('change', closeOnWideScreen);
    }, []);

    return (
        <TooltipProvider>
            <Sheet open={menuOpen} onOpenChange={(open) => setMenuLocation(open ? location.key : null)}>
                <div className="paper min-h-svh text-foreground md:grid md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[272px_minmax(0,1fr)]">
                    <a
                        href="#main-content"
                        className="sr-only z-[60] rounded-lg bg-background p-3 text-foreground shadow focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
                    >
                        {t('common.skipToContent')}
                    </a>

                    <aside className="sticky top-0 hidden h-dvh min-h-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block lg:hidden">
                        <Sidebar variant="rail" />
                    </aside>
                    <aside className="sticky top-0 hidden h-dvh min-h-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
                        <Sidebar variant="full" />
                    </aside>

                    <div className="flex min-h-svh min-w-0 flex-col">
                        <Header />
                        <main
                            id="main-content"
                            tabIndex={-1}
                            className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-3 py-5 outline-none sm:px-6 sm:py-6 lg:px-8 lg:py-8"
                        >
                            <Suspense fallback={<LoadingState rows={6} />}>
                                <Outlet />
                            </Suspense>
                        </main>
                        <footer className="px-4 pt-2 pb-24 text-center text-xs text-muted-foreground sm:px-6 md:pb-6 lg:px-8">
                            {t('brand.platform')}
                        </footer>
                    </div>
                </div>

                <MobileTabBar />

                <SheetContent
                    side="left"
                    className="w-[min(320px,88vw)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground [&>button]:hover:bg-white/10"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{t('nav.main')}</SheetTitle>
                        <SheetDescription>{t('nav.menuHint')}</SheetDescription>
                    </SheetHeader>
                    <Sidebar variant="sheet" onNavigate={() => setMenuLocation(null)} />
                </SheetContent>
            </Sheet>
        </TooltipProvider>
    );
}
