import { Menu } from 'lucide-react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { TodayChip } from '@/components/common/TodayChip';
import { SheetTrigger } from '@/components/ui/sheet';

const PAGE_TITLE_KEYS: Record<string, string> = {
    '/me': 'nav.profile',
    '/me/schools': 'nav.mySchools',
    '/schools': 'nav.schools',
    '/forbidden': 'nav.forbidden',
    '/students': 'nav.students',
    '/teachers': 'nav.teachers',
    '/terminals': 'nav.terminals',
    '/attendance': 'nav.attendance',
    '/users': 'nav.users',
};

export function Header() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const { pathname } = useLocation();
    if (!session) return null;

    const { profile } = session;
    const fullName = [
        profile.lastName,
        profile.firstName,
        profile.middleName,
    ]
        .filter(Boolean)
        .join(' ') || profile.login;

    const initials = [
        profile.firstName?.charAt(0),
        profile.lastName?.charAt(0),
    ]
        .filter(Boolean)
        .join('')
        .toUpperCase() || profile.login.slice(0, 2).toUpperCase();
    const title = t(PAGE_TITLE_KEYS[pathname.replace(/\/+$/, '')] ?? 'nav.cabinet');

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <SheetTrigger asChild>
                        <button
                            type="button"
                            aria-label={t('nav.openMenu')}
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                        >
                            <Menu aria-hidden="true" className="size-5" />
                        </button>
                    </SheetTrigger>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('nav.breadcrumb')}</p>
                        <p className="mt-0.5 break-words font-heading text-base font-bold tracking-tight sm:text-lg">{title}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <TodayChip />
                    <LanguageSwitcher className="hidden sm:inline-flex" />
                    <ThemeToggle />
                    <div className="hidden items-center gap-3 border-l border-border pl-3 lg:flex">
                        <div
                            aria-hidden="true"
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                        >
                            {initials.toUpperCase()}
                        </div>
                        <div className="min-w-0 max-w-48">
                            <p title={fullName} className="truncate text-sm font-semibold">{fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">{t(`roles.${profile.role}`)}</p>
                        </div>
                    </div>
                    <LogoutButton />
                </div>
            </div>
        </header>
    );
}
