import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Masalan: «O‘quvchilar ro‘yxati sahifalari». */
    label?: string;
    total?: number;
    pageSize?: number;
    shownCount?: number;
    className?: string;
}

/** Oldingi / keyingi tugmalari va «1–20 / 345» ko‘rsatkichi. */
export function Pagination({
    page,
    totalPages,
    onPageChange,
    label,
    total,
    pageSize,
    shownCount,
    className,
}: PaginationProps) {
    const { t } = useTranslation();
    const pages = Math.max(totalPages, 1);

    const range =
        total !== undefined && pageSize !== undefined && shownCount !== undefined && shownCount > 0
            ? t('common.pagination.range', {
                from: formatNumber((page - 1) * pageSize + 1),
                to: formatNumber((page - 1) * pageSize + shownCount),
                total: formatNumber(total),
            })
            : null;

    return (
        <nav
            aria-label={label ?? t('common.pagination.label')}
            className={cn(
                'flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            <p className="text-center text-sm text-muted-foreground tabular-nums sm:text-left">
                {range ?? t('common.pagination.pageOf', { page, total: pages })}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft aria-hidden="true" />
                    {t('common.pagination.prev')}
                </Button>
                {range && (
                    <span className="px-2 text-sm font-medium tabular-nums">
                        {page} / {pages}
                    </span>
                )}
                <Button
                    type="button"
                    variant="outline"
                    disabled={page >= pages}
                    onClick={() => onPageChange(page + 1)}
                >
                    {t('common.pagination.next')}
                    <ChevronRight aria-hidden="true" />
                </Button>
            </div>
        </nav>
    );
}
