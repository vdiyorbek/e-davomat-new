import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatDateLong, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';

export function TodayChip({ className }: { className?: string }) {
    const { t } = useTranslation();
    // Til o‘zgarganda qayta chiziladi (useTranslation orqali).

    return (
        <p
            className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground',
                className,
            )}
        >
            <CalendarDays aria-hidden="true" className="size-4 text-primary" />
            <span className="sr-only">{t('common.today')}: </span>
            <span>{formatDateLong(todayInTashkent())}</span>
        </p>
    );
}
