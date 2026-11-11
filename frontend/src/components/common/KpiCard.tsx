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
}

/** Sahifa tepasidagi ko‘rsatkich kartasi (Terminals, Monitoring, Tarix). */
export function KpiCard({ label, value, icon: Icon, tone = 'primary', hint, loading = false }: Props) {
    return (
        <Card className="min-w-0 gap-0 p-4">
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
        </Card>
    );
}
