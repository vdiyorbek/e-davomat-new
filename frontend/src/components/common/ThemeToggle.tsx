import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/app/providers/theme-context';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Theme; icon: LucideIcon }[] = [
    { value: 'light', icon: Sun },
    { value: 'system', icon: Monitor },
    { value: 'dark', icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();

    return (
        <div
            role="group"
            aria-label={t('common.theme')}
            className={cn('inline-flex rounded-xl border border-border bg-muted/60 p-0.5', className)}
        >
            {OPTIONS.map(({ value, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    aria-label={t(`theme.${value}`)}
                    title={t(`theme.${value}`)}
                    onClick={() => setTheme(value)}
                    className={cn(
                        'grid size-8 place-items-center rounded-[10px] text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        theme === value && 'bg-card text-foreground shadow-sm',
                    )}
                >
                    <Icon aria-hidden="true" className="size-4" />
                </button>
            ))}
        </div>
    );
}
