import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const TONES: Record<StatusTone, string> = {
    success: 'bg-success/12 text-[color-mix(in_oklch,var(--success),var(--foreground)_30%)] ring-success/30',
    warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning),var(--foreground)_62%)] ring-warning/40',
    danger: 'bg-destructive/10 text-destructive ring-destructive/25',
    info: 'bg-chart-5/10 text-chart-5 ring-chart-5/25 dark:text-foreground',
    primary: 'bg-primary/10 text-primary ring-primary/25 dark:text-[color-mix(in_oklch,var(--primary),white_35%)]',
    neutral: 'bg-muted text-muted-foreground ring-border',
};

const DOTS: Record<StatusTone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-chart-5',
    primary: 'bg-primary',
    neutral: 'bg-muted-foreground/60',
};

/** Holat belgisi: rang + nuqta + matn (faqat rangga tayanmaydi). */
export function StatusBadge({
    tone,
    children,
    className,
    dot = true,
}: {
    tone: StatusTone;
    children: ReactNode;
    className?: string;
    dot?: boolean;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
                TONES[tone],
                className,
            )}
        >
            {dot && <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOTS[tone])} />}
            {children}
        </span>
    );
}
