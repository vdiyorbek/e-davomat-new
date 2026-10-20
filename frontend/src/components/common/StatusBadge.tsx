import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const TONES: Record<StatusTone, string> = {
    success: 'bg-success/12 text-[color-mix(in_oklch,var(--success),var(--foreground)_30%)] ring-success/30',
    warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning),var(--foreground)_62%)] ring-warning/40',
    danger: 'bg-destructive/10 text-destructive ring-destructive/25',
    info: 'bg-info/12 text-[color-mix(in_oklch,var(--info),var(--foreground)_25%)] ring-info/30',
    primary: 'bg-violet/12 text-[color-mix(in_oklch,var(--violet),var(--foreground)_25%)] ring-violet/30',
    neutral: 'bg-muted text-muted-foreground ring-border',
};

const DOTS: Record<StatusTone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
    primary: 'bg-violet',
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
