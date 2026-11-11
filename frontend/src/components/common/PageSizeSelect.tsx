import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';

/** «Sahifada: 10 / 20 / 30 / 50» tanlovi — Pagination yonida turadi. */
export function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">{t('common.pagination.perPage')}</span>
            <SelectField
                value={String(value)}
                onValueChange={(next) => onChange(Number(next))}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
                aria-label={t('common.pagination.perPageLabel')}
                className="h-10 w-20"
            />
        </div>
    );
}