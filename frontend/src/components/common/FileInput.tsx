import { useId } from 'react';
import type { ReactNode } from 'react';
import { FileUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileInputProps {
    id?: string;
    name?: string;
    accept?: string;
    file: File | null;
    onFileChange: (file: File | null) => void;
    disabled?: boolean;
    required?: boolean;
    /** Tugma matni, standart: «Fayl tanlash». */
    buttonLabel?: ReactNode;
    icon?: ReactNode;
    className?: string;
    'aria-describedby'?: string;
}

/** shadcn uslubidagi fayl tanlash maydoni (native input yashirin). */
export function FileInput({
    id,
    name,
    accept,
    file,
    onFileChange,
    disabled,
    required,
    buttonLabel,
    icon,
    className,
    ...aria
}: FileInputProps) {
    const { t } = useTranslation();
    const fallbackId = useId();
    const inputId = id ?? fallbackId;

    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border border-dashed border-input bg-muted/30 p-3 sm:flex-row sm:items-center',
                disabled && 'opacity-60',
                className,
            )}
        >
            <Button asChild type="button" variant="outline" className="w-full shrink-0 bg-card sm:w-auto">
                <label htmlFor={inputId} className={cn('cursor-pointer', disabled && 'pointer-events-none')}>
                    {icon ?? <FileUp aria-hidden="true" />}
                    {buttonLabel ?? t('file.choose')}
                </label>
            </Button>
            <input
                id={inputId}
                name={name}
                type="file"
                accept={accept}
                disabled={disabled}
                required={required && !file}
                className="sr-only"
                aria-describedby={aria['aria-describedby']}
                onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    // Bir xil faylni qayta tanlash ham ishlashi uchun.
                    event.target.value = '';
                    if (selected) onFileChange(selected);
                }}
            />
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <p className={cn('min-w-0 flex-1 truncate text-sm', !file && 'text-muted-foreground')}>
                    {file ? file.name : t('file.none')}
                </p>
                {file && (
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                        aria-label={t('file.remove')}
                        onClick={() => onFileChange(null)}
                    >
                        <X aria-hidden="true" />
                    </Button>
                )}
            </div>
        </div>
    );
}
