import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Telefon kartalari ichidagi «nom: qiymat» ro‘yxati. */
export function DetailList({ className, children }: { className?: string; children: ReactNode }) {
    return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 text-sm', className)}>{children}</dl>;
}

export function DetailItem({
    label,
    children,
    wide,
    className,
}: {
    label: ReactNode;
    children: ReactNode;
    wide?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', wide && 'col-span-2', className)}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{children}</dd>
        </div>
    );
}
