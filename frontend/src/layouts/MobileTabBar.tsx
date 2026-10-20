import { Menu } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

import { mobileNavItems } from './nav-config';

/** Telefon uchun pastki navigatsiya paneli (md dan kichik ekranlarda). */
export function MobileTabBar() {
    const { t } = useTranslation();
    const { session } = useAuth();
    if (!session) return null;

    const items = mobileNavItems(session.profile.role);
    if (items.length < 2) return null;

    const itemClass =
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-tight font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring';

    return (
        <nav
            aria-label={t('nav.quick')}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        >
            <ul className="mx-auto flex max-w-lg items-stretch gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.to} className="flex flex-1">
                            <NavLink
                                to={item.to}
                                end
                                className={({ isActive }) =>
                                    cn(itemClass, isActive ? 'text-primary' : 'text-muted-foreground')
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span
                                            className={cn(
                                                'grid h-7 w-12 place-items-center rounded-full transition-colors',
                                                isActive && 'bg-primary/12',
                                            )}
                                        >
                                            <Icon aria-hidden="true" className="size-5" />
                                        </span>
                                        <span className="line-clamp-1 max-w-full">{t(`nav.short.${item.key}`)}</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                    );
                })}
                <li className="flex flex-1">
                    <SheetTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            className={cn(itemClass, 'h-auto text-muted-foreground hover:bg-transparent')}
                        >
                            <span className="grid h-7 w-12 place-items-center rounded-full">
                                <Menu aria-hidden="true" className="size-5" />
                            </span>
                            <span>{t('nav.short.more')}</span>
                        </Button>
                    </SheetTrigger>
                </li>
            </ul>
        </nav>
    );
}
