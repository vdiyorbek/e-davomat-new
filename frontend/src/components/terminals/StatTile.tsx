import { formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';

/** Kichik ko‘rsatkich plitkasi (sarlavha + katta raqam). */
export function StatTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: number | string;
    tone?: 'success' | 'warning' | 'danger';
}) {
    return (
        <div className="min-w-0 rounded-xl border bg-muted/25 p-3">
            <div className="truncate text-xs text-muted-foreground">{label}</div>
            <div
                className={cn(
                    'mt-1 text-xl font-semibold tabular-nums',
                    tone === 'success' && 'text-success',
                    tone === 'warning' && 'text-[color-mix(in_oklch,var(--warning),var(--foreground)_40%)]',
                    tone === 'danger' && 'text-destructive',
                )}
            >
                {typeof value === 'number' ? formatNumber(value) : value}
            </div>
        </div>
    );
}
