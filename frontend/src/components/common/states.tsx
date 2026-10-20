import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Ro‘yxat yuklanayotganda ko‘rsatiladigan skelet. */
export function LoadingState({
    label,
    rows = 5,
    className,
}: {
    label?: string;
    rows?: number;
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn('space-y-3 rounded-2xl border bg-card p-4 sm:p-5', className)}
        >
            <span className="sr-only">{label ?? t('common.loading')}</span>
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex items-center gap-3" aria-hidden="true">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                    <Skeleton className="hidden h-8 w-20 sm:block" />
                </div>
            ))}
        </div>
    );
}

/** Xatolik xabari va «Qayta urinish» tugmasi. */
export function ErrorState({
    message,
    title,
    onRetry,
    className,
}: {
    message: ReactNode;
    title?: ReactNode;
    onRetry?: () => void;
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <Alert variant="destructive" className={className}>
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>{title ?? t('common.errorTitle')}</AlertTitle>
            <AlertDescription>
                <p>{message}</p>
                {onRetry && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 border-destructive/30 text-foreground"
                        onClick={onRetry}
                    >
                        <RotateCw aria-hidden="true" />
                        {t('common.retry')}
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
}

/** Ma’lumot topilmaganda ko‘rsatiladigan blok. */
export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center',
                className,
            )}
        >
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Icon aria-hidden="true" className="size-6" />
            </span>
            <h2 className="font-heading text-base font-semibold">{title}</h2>
            {description && (
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

/** Muvaffaqiyatli amal haqida xabar. */
export function SuccessNotice({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <Alert variant="success" className={className}>
            <AlertDescription className="font-medium">{children}</AlertDescription>
        </Alert>
    );
}
