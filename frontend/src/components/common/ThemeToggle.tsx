
import { Monitor, Moon, Sun, SunMoon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/app/providers/theme-context';
import { cn } from '@/lib/utils';

const OPTIONS: {
    value: Theme;
    icon: LucideIcon;
}[] = [
        { value: 'light', icon: Sun },
        { value: 'system', icon: Monitor },
        { value: 'dark', icon: Moon },
    ];

export function ThemeToggle({
    className,
}: {
    className?: string;
}) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();

    return (
        <>
            {/* Telefon: ixcham select */}
            <label
                className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1',
                    'rounded-xl border border-border',
                    'bg-card px-2 text-foreground',
                    'focus-within:ring-2 focus-within:ring-ring',
                    'sm:hidden',
                    className,
                )}
            >
                <SunMoon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                />

                <span className="sr-only">
                    {t('common.theme')}
                </span>

                <select
                    value={theme}
                    aria-label={t('common.theme')}
                    onChange={(event) =>
                        setTheme(event.target.value as Theme)
                    }
                    className="
  w-[72px]
  cursor-pointer
  bg-transparent
  text-xs font-medium
  outline-none
"
                >
                    {OPTIONS.map(({ value }) => (
                        <option
                            key={value}
                            value={value}
                            className="bg-card text-foreground"
                        >
                            {t(`theme.${value}`)}
                        </option>
                    ))}
                </select>
            </label>

            {/* Planshet va kompyuter: uchta tugma */}
            <div
                role="group"
                aria-label={t('common.theme')}
                className={cn(
                    'hidden rounded-xl border border-border',
                    'bg-muted/60 p-0.5',
                    'sm:inline-flex',
                    className,
                )}
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
                            'grid size-8 place-items-center',
                            'rounded-[10px]',
                            'text-muted-foreground',
                            'transition-colors',
                            'focus-visible:outline-none',
                            'focus-visible:ring-2',
                            'focus-visible:ring-ring',
                            theme === value &&
                            'bg-card text-foreground shadow-sm',
                        )}
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4"
                        />
                    </button>
                ))}
            </div>
        </>
    );
}
