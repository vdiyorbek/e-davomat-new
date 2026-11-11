import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

export type KpiTone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';

const TONES: Record<KpiTone, string> = {
    primary: 'bg-primary/12 text-primary',
    success: 'bg-success/14 text-success',
    danger: 'bg-destructive/12 text-destructive',
    warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning),var(--foreground)_45%)]',
    neutral: 'bg-muted text-muted-foreground',
};

interface Props {
    label: string;
    value: number | string;
    icon: LucideIcon;
    tone?: KpiTone;
    hint?: string;
    loading?: boolean;
    /** Berilsa — karta tugma bo‘ladi (masalan, ro‘yxatni filtrlash). */
    onClick?: () => void;
    /** Karta tanlangan (filtr yoqilgan) holatda. */
    active?: boolean;
}

/** Sahifa tepasidagi ko‘rsatkich kartasi (Terminals, Monitoring, Tarix). */
export function KpiCard({
    label,
    value,
    icon: Icon,
    tone = 'primary',
    hint,
    loading = false,
    onClick,
    active = false,
}: Props) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
                    {loading ? (
                        <Skeleton className="mt-2 h-8 w-14" />
                    ) : (
                        <p className="mt-1 truncate font-heading text-2xl font-bold tabular-nums sm:text-3xl">
                            {typeof value === 'number' ? formatNumber(value) : value}
                        </p>
                    )}
                </div>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', TONES[tone])}>
                    <Icon aria-hidden="true" className="size-5" />
                </span>
            </div>
            {hint && <p className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </>
    );

    if (!onClick) {
        return <Card className="min-w-0 gap-0 p-4">{content}</Card>;
    }

    return (
        <Card
            className={cn(
                'min-w-0 gap-0 p-0 transition-shadow',
                active && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
        >
            <button
                type="button"
                onClick={onClick}
                aria-pressed={active}
                className="w-full rounded-[inherit] p-4 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
                {content}
            </button>
        </Card>
    );
}