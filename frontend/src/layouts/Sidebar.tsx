import { Building2, UserRound, Users, BookOpen, ScanFace, ClipboardCheck, School, UserCog, FileCheck2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { NavLinkRenderProps } from 'react-router';

interface SidebarProps {
    mobile?: boolean;
    onNavigate?: () => void;
}

interface MenuLink {
    to: string;
    label: string;
    icon: LucideIcon;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
    const { t } = useTranslation();
    const { session } = useAuth();
    if (!session) return null;

    const personal: MenuLink[] = [
        { to: '/me', label: t('nav.profile'), icon: UserRound },
    ];
    const manage: MenuLink[] = ADMIN_ROLES.includes(session.profile.role)
        ? [
            {
                to: '/attendance/students',
                label: 'O‘quvchilar davomati',
                icon: ClipboardCheck,
            },
            {
                to: '/attendance/teachers',
                label: 'O‘qituvchilar davomati',
                icon: ClipboardCheck,
            },
            ...(
                session.profile.role === 'SUPER_ADMIN' ||
                    session.profile.role === 'SCHOOL_ADMIN'
                    ? [
                        {
                            to: '/attendance-excuses',
                            label: 'Sababli arizalar',
                            icon: FileCheck2,
                        },
                    ]
                    : []
            ),
            { to: '/schools', label: t('nav.schools'), icon: Building2 },
            { to: '/students', label: t('nav.students'), icon: Users },
            { to: '/teachers', label: t('nav.teachers'), icon: BookOpen },
            { to: '/terminals', label: t('nav.terminals'), icon: ScanFace },
            { to: '/classes', label: t('nav.classes'), icon: School },
            {
                to: '/users',
                label: 'Foydalanuvchilar',
                icon: UserCog,
            },
        ]
        : [];

    const wide = mobile ? '' : 'sr-only lg:not-sr-only';

    function renderGroup(label: string, links: MenuLink[]) {
        if (links.length === 0) return null;
        return (
            <div className="space-y-1">
                <p className={cn('px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45', wide)}>
                    {label}
                </p>
                {links.map(({ to, label: text, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end
                        title={text}
                        onClick={onNavigate}
                        className={({ isActive }: NavLinkRenderProps) =>
                            cn(
                                'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                                !mobile && 'justify-center lg:justify-start',
                                isActive
                                    ? 'bg-white/10 font-semibold text-white'
                                    : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white',
                            )
                        }
                    >
                        {({ isActive }: NavLinkRenderProps) => (
                            <>
                                {isActive && (
                                    <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-warning" />
                                )}
                                <span
                                    className={cn(
                                        'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
                                        isActive ? 'bg-sidebar-primary text-white' : 'bg-white/5 text-sidebar-foreground/80 group-hover:bg-white/10',
                                    )}
                                >
                                    <Icon aria-hidden="true" className="size-4" />
                                </span>
                                <span className={cn('truncate', wide)}>{text}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={cn(
                    'flex shrink-0 items-center gap-3 py-6',
                    mobile ? 'px-5 pr-12' : 'justify-center px-3 lg:justify-start lg:px-5',
                )}
            >
                <img src="/logotip.jpg" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl bg-white object-contain p-1" />
                <div className={cn('min-w-0', wide)}>
                    <p className="font-heading text-lg font-extrabold tracking-tight text-white">{t('brand.name')}</p>
                    <p className="mt-0.5 text-xs text-sidebar-foreground/60">{t('brand.tagline')}</p>
                </div>
            </div>

            <nav aria-label={t('nav.main')} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-2">
                {renderGroup(t('nav.groupPersonal'), personal)}
                {renderGroup(t('nav.groupManage'), manage)}
            </nav>

            <div className={cn('shrink-0 space-y-3 px-4 py-5', !mobile && 'hidden lg:block')}>
                {mobile && <LanguageSwitcher className="w-full" />}
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
        </div>
    );
}
