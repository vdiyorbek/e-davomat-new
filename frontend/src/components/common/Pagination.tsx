import { useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageSizeSelect } from '@/components/common/PageSizeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/date';
import { getPageItems, PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { cn } from '@/lib/utils';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    /** Masalan: «O‘quvchilar ro‘yxati sahifalari». */
    label?: string;
    total?: number;
    pageSize?: number;
    shownCount?: number;
    className?: string;
}

function PageButtons({
    page,
    pages,
    siblings,
    onPageChange,
    className,
}: {
    page: number;
    pages: number;
    siblings: number;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <ul className={cn('flex items-center gap-1', className)}>
            {getPageItems(page, pages, siblings).map((item) =>
                typeof item === 'number' ? (
                    <li key={item}>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant={item === page ? 'default' : 'ghost'}
                            aria-label={t('common.pagination.goTo', { page: item })}
                            aria-current={item === page ? 'page' : undefined}
                            onClick={() => onPageChange(item)}
                            className={cn(
                                'min-w-9 px-2 tabular-nums',
                                item === page && 'pointer-events-none',
                            )}
                        >
                            {formatNumber(item)}
                        </Button>
                    </li>
                ) : (
                    <li key={item} aria-hidden="true" className="w-6 text-center text-muted-foreground select-none">
                        …
                    </li>
                ),
            )}
        </ul>
    );
}

/** «Sahifaga o‘tish» maydoni: raqam yozib Enter bosiladi. */
function JumpToPage({ pages, onPageChange }: { pages: number; onPageChange: (page: number) => void }) {
    const { t } = useTranslation();
    const id = useId();
    const [value, setValue] = useState('');

    function submit() {
        const target = Number(value);
        if (!Number.isInteger(target)) return;
        onPageChange(Math.min(Math.max(target, 1), pages));
        setValue('');
    }

    return (
        <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <label htmlFor={id} className="text-sm whitespace-nowrap text-muted-foreground max-sm:sr-only">
                {t('common.pagination.jump')}
            </label>
            <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={pages}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`1–${pages}`}
                className="h-8 w-16 text-center tabular-nums sm:h-9 sm:w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
        </form>
    );
}

/** Raqamli sahifalash: ‹ 1 … 9 10 11 … 20 ›, «1–20, jami 345» va sahifaga o‘tish. */
export function Pagination({
    page,
    totalPages,
    onPageChange,
    label,
    total,
    pageSize,
    shownCount,
    onPageSizeChange,
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
            : t('common.pagination.pageOf', { page, total: pages });

    function go(target: number) {
        if (target !== page && target >= 1 && target <= pages) onPageChange(target);
    }
    const pageSizeControl =
        onPageSizeChange && pageSize !== undefined && total !== undefined && total > PAGE_SIZE_OPTIONS[0] ? (
            <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        ) : null;

    return (
        <nav
            aria-label={label ?? t('common.pagination.label')}
            className={cn(
                'flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between',
                className,
            )}
        >
            {/* Telefonda: «1–20, jami 345» va «Sahifada [20]» bitta qatorda */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground tabular-nums">{range}</p>
                {pageSizeControl && <div className="md:hidden">{pageSizeControl}</div>}
            </div>

            {(pages > 1 || pageSizeControl) && (
                <div className={cn('flex items-center justify-center gap-2 sm:gap-4', pages <= 1 && 'max-md:hidden')}>
                    {pages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={page <= 1}
                                onClick={() => go(page - 1)}
                                aria-label={t('common.pagination.prev')}
                                title={t('common.pagination.prev')}
                            >
                                <ChevronLeft aria-hidden="true" />
                            </Button>

                            {/* Telefonda: 1 … 10 … 20; kattaroq ekranda: 1 … 9 10 11 … 20 */}
                            <PageButtons page={page} pages={pages} siblings={0} onPageChange={go} className="sm:hidden" />
                            <PageButtons page={page} pages={pages} siblings={1} onPageChange={go} className="max-sm:hidden" />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={page >= pages}
                                onClick={() => go(page + 1)}
                                aria-label={t('common.pagination.next')}
                                title={t('common.pagination.next')}
                            >
                                <ChevronRight aria-hidden="true" />
                            </Button>
                        </div>
                    )}

                    {pages > 7 && <JumpToPage pages={pages} onPageChange={go} />}

                    {/* Kompyuterda tanlov o‘ng tomonda, sahifa tugmalaridan keyin */}
                    {pageSizeControl && <div className="max-md:hidden">{pageSizeControl}</div>}
                </div>
            )}
        </nav>
    );
}