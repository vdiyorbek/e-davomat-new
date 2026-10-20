import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/app/providers/theme-context';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: Theme; icon: LucideIcon }[] = [
    { value: 'light', icon: Sun },
    { value: 'dark', icon: Moon },
    { value: 'system', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const CurrentIcon = THEME_OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={cn('bg-card', className)}
                    aria-label={`${t('common.theme')}: ${t(`theme.${theme}`)}`}
                >
                    <CurrentIcon aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>{t('common.theme')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {THEME_OPTIONS.map(({ value, icon: Icon }) => (
                    <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className="gap-3">
                        <Icon aria-hidden="true" />
                        <span className="flex-1">{t(`theme.${value}`)}</span>
                        {theme === value && <Check aria-hidden="true" className="text-primary" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
