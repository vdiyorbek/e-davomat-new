import { Check, Languages } from 'lucide-react';
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
import { LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
    className?: string;
    /** `full` — til nomi bilan, `compact` — faqat qisqa kod. */
    variant?: 'full' | 'compact';
    align?: 'start' | 'end';
}

export function LanguageSwitcher({ className, variant = 'compact', align = 'end' }: LanguageSwitcherProps) {
    const { t, i18n } = useTranslation();
    const current = LANGUAGES.find((lang) => lang.code === i18n.resolvedLanguage) ?? LANGUAGES[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn('gap-2 bg-card px-3', variant === 'full' && 'justify-start', className)}
                    aria-label={`${t('common.language')}: ${current.label}`}
                >
                    <Languages aria-hidden="true" className="text-muted-foreground" />
                    {variant === 'full' ? (
                        <span className="truncate">{current.label}</span>
                    ) : (
                        <span className="text-xs font-bold tracking-wide">{current.short}</span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="min-w-48">
                <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LANGUAGES.map((lang) => {
                    const active = lang.code === current.code;
                    return (
                        <DropdownMenuItem
                            key={lang.code}
                            lang={lang.code}
                            onSelect={() => void i18n.changeLanguage(lang.code)}
                            className="gap-3"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'grid h-6 w-8 place-items-center rounded-md text-[10px] font-bold',
                                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}
                            >
                                {lang.short}
                            </span>
                            <span className="flex-1">{lang.label}</span>
                            {active && <Check aria-hidden="true" className="text-primary" />}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
