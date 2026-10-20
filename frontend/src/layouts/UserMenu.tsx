import { useState } from 'react';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useUserPhoto } from '@/hooks/useUserPhoto';
import { ApiError } from '@/lib/api';
import { personFullName, personInitials } from '@/lib/person';

export function UserMenu() {
    const { t } = useTranslation();
    const { session, logout } = useAuth();
    const photo = useUserPhoto(session?.profile.id, session?.profile.photoUrl);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!session) return null;

    const { profile } = session;
    const fullName = personFullName(profile, profile.login);
    const initials = personInitials(profile, profile.login.slice(0, 2).toUpperCase());

    async function handleLogout() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await logout();
        } catch (err: unknown) {
            setError(err instanceof ApiError ? err.message : t('common.signOutFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="relative">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-11 gap-2.5 rounded-xl px-1.5 sm:pr-2.5"
                        aria-label={t('common.account')}
                    >
                        <Avatar size="lg" className="size-9">
                            {photo && <AvatarImage src={photo} alt="" />}
                            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="hidden min-w-0 max-w-44 text-left lg:block">
                            <span className="block truncate text-sm leading-5 font-semibold">{fullName}</span>
                            <span className="block truncate text-xs leading-4 font-normal text-muted-foreground">
                                {t(`roles.${profile.role}`)}
                            </span>
                        </span>
                        <ChevronDown aria-hidden="true" className="hidden text-muted-foreground sm:block" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex items-center gap-3 py-2">
                        <Avatar size="lg">
                            {photo && <AvatarImage src={photo} alt="" />}
                            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{fullName}</span>
                            <span className="block truncate text-xs font-normal">
                                @{profile.login} · {t(`roles.${profile.role}`)}
                            </span>
                        </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to="/me">
                            <UserRound aria-hidden="true" />
                            {t('nav.items.profile')}
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={busy}
                        onSelect={(event) => {
                            event.preventDefault();
                            void handleLogout();
                        }}
                    >
                        <LogOut aria-hidden="true" />
                        {busy ? t('common.signingOut') : t('common.signOut')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {error && (
                <p
                    role="alert"
                    className="absolute top-full right-0 z-40 mt-2 w-64 rounded-xl border border-destructive/30 bg-popover p-3 text-xs text-destructive shadow-md"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
