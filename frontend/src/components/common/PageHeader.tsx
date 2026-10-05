import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                        <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-warning" />
                        {eyebrow}
                    </p>
                )}
                <h1>{title}</h1>
                {description && (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
