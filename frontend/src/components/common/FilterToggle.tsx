import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
    expanded: boolean;
    /** Yashirin bo‘limdagi faol filtrlar soni. */
    count: number;
    /** Ochiladigan bo‘limning id’si (aria-controls). */
    controls: string;
    onToggle: () => void;
    className?: string;
}

/** «Ko‘proq filtr / Kamroq filtr» tugmasi — davomat sahifasidagi kabi. */
export function FilterToggle({ expanded, count, controls, onToggle, className }: Props) {
    const { t } = useTranslation();

    return (
        <Button
            type="button"
            variant="outline"
            className={cn('h-11 w-full bg-card md:w-auto', className)}
            aria-expanded={expanded}
            aria-controls={controls}
            onClick={onToggle}
        >
            <Filter aria-hidden="true" />
            {expanded ? t('filters.showLess') : t('filters.showMore')}
            {count > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {count}
                </span>
            )}
        </Button>
    );
}