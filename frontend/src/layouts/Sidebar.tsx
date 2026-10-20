import { Menu } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

import { BrandMark } from './Brand';
import { navGroupsFor } from './nav-config';
import type { NavItem } from './nav-config';

interface SidebarProps {
    /** `rail` — planshetdagi tor ikonka paneli, `full` — kompyuter, `sheet` — telefondagi chiquvchi menyu. */
    variant: 'full' | 'rail' | 'sheet';
    onNavigate?: () => void;
}

export function Sidebar({ variant, onNavigate }: SidebarProps) {
    const { t } = useTranslation();
    const { session } = useAuth();
    if (!session) return null;

    const rail = variant === 'rail';
    const groups = navGroupsFor(session.profile.role);

    function renderLink(item: NavItem) {
        const label = t(`nav.items.${item.key}`);
        const Icon = item.icon;

        const link = (
            <NavLink
                to={item.to}
                end
                onClick={onNavigate}
                aria-label={rail ? label : undefined}
                className={({ isActive }) =>
                    cn(
                        'group relative flex min-h-11 items-center gap-3 rounded-xl text-sm transition-colors motion-reduce:transition-none',
                        'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        rail ? 'mx-auto size-12 justify-center' : 'px-2.5 py-1.5',
                        isActive
                            ? 'bg-brand-gradient font-semibold text-white shadow-lg shadow-gradient-to/25'
                            : 'text-sidebar-foreground/75 hover:bg-white/6 hover:text-white',
                    )
                }
            >
                {({ isActive }) => (
                    <>
                        {isActive && (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'absolute top-2.5 bottom-2.5 w-1 rounded-full bg-gradient-from',
                                    rail ? '-left-2.5' : '-left-3',
                                )}
                            />
                        )}
                        <span
                            className={cn(
                                'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
                                isActive
                                    ? 'bg-white/18 text-white'
                                    : 'bg-white/5 text-sidebar-foreground/80 group-hover:bg-white/10',
                            )}
                        >
                            <Icon aria-hidden="true" className="size-4" />
                        </span>
                        {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
                    </>
                )}
            </NavLink>
        );

        if (!rail) return <li key={item.to}>{link}</li>;

        return (
            <li key={item.to}>
                <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
            </li>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={cn(
                    'flex shrink-0 items-center gap-3',
                    rail ? 'justify-center px-2 py-5' : 'px-5 py-5',
                    variant === 'sheet' && 'pr-12',
                )}
            >
                <BrandMark className="size-11" />
                {!rail && (
                    <div className="min-w-0">
                        <p className="font-heading text-lg leading-tight font-extrabold tracking-[0.08em] text-white uppercase">
                            {t('brand.name')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">{t('brand.tagline')}</p>
                    </div>
                )}
            </div>

            {rail && (
                <div className="flex shrink-0 justify-center pb-3">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <SheetTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('nav.openMenu')}
                                    className="size-12 rounded-xl bg-white/5 text-sidebar-foreground hover:bg-white/10 hover:text-white"
                                >
                                    <Menu aria-hidden="true" className="size-5" />
                                </Button>
                            </SheetTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">{t('nav.openMenu')}</TooltipContent>
                    </Tooltip>
                </div>
            )}

            <ScrollArea className="min-h-0 flex-1">
                <nav aria-label={t('nav.main')} className={cn('space-y-5 pb-4', rail ? 'px-2.5' : 'px-3')}>
                    {groups.map((group) => (
                        <div key={group.key}>
                            {rail ? (
                                <div aria-hidden="true" className="mx-auto mb-2 h-px w-8 bg-sidebar-border first:hidden" />
                            ) : (
                                <p className="px-2.5 pb-2 text-[11px] font-bold tracking-[0.14em] text-sidebar-foreground/45 uppercase">
                                    {t(`nav.groups.${group.key}`)}
                                </p>
                            )}
                            <ul className="space-y-1">{group.items.map(renderLink)}</ul>
                        </div>
                    ))}
                </nav>
            </ScrollArea>

            {variant === 'sheet' && (
                <div className="shrink-0 space-y-3 border-t border-sidebar-border px-4 py-4">
                    <p className="text-[11px] font-bold tracking-[0.14em] text-sidebar-foreground/45 uppercase">
                        {t('nav.settings')}
                    </p>
                    <div className="flex gap-2 text-foreground">
                        <LanguageSwitcher variant="full" align="start" className="flex-1" />
                        <ThemeToggle />
                    </div>
                </div>
            )}

            {variant === 'full' && (
                <div className="shrink-0 px-4 pt-2 pb-5 [@media(max-height:960px)]:hidden">
                    <div className="rounded-2xl bg-white/5 p-4">
                        <div className="mb-3 flex gap-1.5" aria-hidden="true">
                            <span className="size-2.5 rounded-sm bg-success" />
                            <span className="size-2.5 rounded-sm bg-success" />
                            <span className="size-2.5 rounded-sm bg-warning" />
                            <span className="size-2.5 rounded-sm bg-success" />
                        </div>
                        <p className="text-xs font-semibold text-white">{t('nav.cabinet')}</p>
                        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">{t('nav.sidebarNote')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
