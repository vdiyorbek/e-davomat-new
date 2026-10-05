import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
    const { t, i18n } = useTranslation();
    const current = i18n.resolvedLanguage ?? 'uz';

    return (
        <label
            className={cn(
                'relative inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground focus-within:ring-2 focus-within:ring-ring',
                className,
            )}
        >
            <Languages aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="sr-only">{t('common.language')}</span>
            <select
                value={current}
                onChange={(event) => void i18n.changeLanguage(event.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
            >
                {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-card text-foreground">
                        {lang.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
