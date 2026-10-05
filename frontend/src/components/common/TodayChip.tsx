import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LOCALES: Record<string, string> = {
    uz: 'uz-UZ',
    'uz-Cyrl': 'uz-Cyrl-UZ',
    ru: 'ru-RU',
    en: 'en-GB',
};

export function TodayChip() {
    const { t, i18n } = useTranslation();
    const locale = LOCALES[i18n.resolvedLanguage ?? 'uz'] ?? 'uz-UZ';
    const text = new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Tashkent',
        weekday: 'short',
        day: 'numeric',
        month: 'long',
    }).format(new Date());

    return (
        <p className="hidden items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground xl:flex">
            <CalendarDays aria-hidden="true" className="size-4 text-primary" />
            <span className="sr-only">{t('common.today')}: </span>
            <span className="capitalize">{text}</span>
        </p>
    );
}
