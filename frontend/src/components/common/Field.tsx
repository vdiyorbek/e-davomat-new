import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
    /** Boshqaruv elementining id’si — label shu id’ga bog‘lanadi. */
    htmlFor?: string;
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    required?: boolean;
    className?: string;
    children: ReactNode;
}

/** Forma maydoni: label + element + yordamchi matn + xato. */
export function Field({ htmlFor, label, hint, error, required, className, children }: FieldProps) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <Label htmlFor={htmlFor} className="leading-5 font-semibold">
                {label}
                {required && (
                    <span aria-hidden="true" className="text-destructive">*</span>
                )}
            </Label>
            {children}
            {hint && !error && (
                <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
            )}
            {error && (
                <p role="alert" className="text-xs leading-5 font-medium text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
