import { Menu } from 'lucide-react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { TodayChip } from '@/components/common/TodayChip';
import { Button } from '@/components/ui/button';
import { SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';

import { findNavItem, NAV_GROUPS } from './nav-config';
import { UserMenu } from './UserMenu';

const EXTRA_TITLES: Record<string, string> = {
    '/forbidden': 'nav.items.forbidden',
    '/me/schools': 'nav.items.mySchools',
};

export function Header() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const { pathname } = useLocation();

    if (!session) return null;

    const path = pathname.replace(/\/+$/, '') || '/';
    const item = findNavItem(path);
    const group = item && NAV_GROUPS.find((g) => g.items.includes(item));

    const title = EXTRA_TITLES[path]
        ? t(EXTRA_TITLES[path])
        : path.startsWith('/persons/')
            ? t('nav.items.person')
            : item
                ? t(`nav.items.${item.key}`)
                : t('nav.cabinet');

    return (
        <header className="sticky top-0 z-30 w-full min-w-0 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-16 w-full min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 bg-card lg:hidden"
                        aria-label={t('nav.openMenu')}
                    >
                        <Menu aria-hidden="true" />
                    </Button>
                </SheetTrigger>

                

                <div className="min-w-0 flex-1">
                    <p className="hidden truncate text-xs text-muted-foreground sm:block">
                        {t('brand.name')}
                        {group && <> / {t(`nav.groups.${group.key}`)}</>}
                    </p>
                    <p
                        className="truncate font-heading text-base leading-tight font-bold tracking-tight sm:text-lg"
                        title={title}
                    >
                        {title}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <TodayChip className="hidden 2xl:inline-flex" />
                    <LanguageSwitcher className="max-sm:hidden" />
                    <ThemeToggle className="max-sm:hidden" />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
}
