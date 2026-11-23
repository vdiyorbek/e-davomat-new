import { Check, Minus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { DayCell } from '@/types/homeroom';

const STYLE: Record<DayCell, string> = {
    present: 'bg-success/20 text-success',
    absent: 'bg-destructive/15 text-destructive',
    excused: 'bg-violet/20 text-violet',
    dayoff: 'bg-muted text-muted-foreground',
    nodata: 'border border-dashed text-muted-foreground/60',
    future: 'text-transparent',
};

/** Bir kun belgisi: rang + belgi + (ekran o‘quvchilar uchun) matn. */
export function DayCellMark({ cell, className }: { cell: DayCell; className?: string }) {
    const { t } = useTranslation();
    const label = t(`homeroom.cells.${cell}`);
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={cn('grid size-7 place-items-center rounded-md text-xs font-bold', STYLE[cell], className)}
        >
            {cell === 'present' && <Check aria-hidden="true" className="size-4" />}
            {cell === 'absent' && <X aria-hidden="true" className="size-4" />}
            {cell === 'excused' && <span aria-hidden="true">S</span>}
            {(cell === 'dayoff' || cell === 'nodata') && <Minus aria-hidden="true" className="size-3.5" />}
        </span>
    );
}
