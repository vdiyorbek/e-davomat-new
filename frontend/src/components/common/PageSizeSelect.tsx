import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { cn } from '@/lib/utils';

/** «Sahifada: 10 / 20 / 30 / 50» tanlovi — Pagination ichida ishlatiladi. */
export function PageSizeSelect({
    value,
    onChange,
    className,
}: {
    value: number;
    onChange: (size: number) => void;
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span className="text-sm whitespace-nowrap text-muted-foreground">{t('common.pagination.perPage')}</span>
            <SelectField
                value={String(value)}
                onValueChange={(next) => onChange(Number(next))}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
                aria-label={t('common.pagination.perPageLabel')}
                className="h-8 w-[4.5rem] sm:h-9 sm:w-20"
            />
        </div>
    );
}