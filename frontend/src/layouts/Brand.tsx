import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Logotip. `/logotip.jpg` topilmasa, ikonka ko‘rsatiladi. */
export function BrandMark({ className }: { className?: string }) {
    const [failed, setFailed] = useState(false);

    return (
        <span
            className={cn(
                'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5',
                className,
            )}
        >
            {failed ? (
                <ClipboardCheck aria-hidden="true" className="size-3/5 text-primary" />
            ) : (
                <img
                    src="/logotip.jpg"
                    alt=""
                    className="h-full w-full object-contain"
                    onError={() => setFailed(true)}
                />
            )}
        </span>
    );
}

interface BrandProps {
    compact?: boolean;
    /** Qorong‘i (navy) fon ustida ishlatilsa true */
    onDark?: boolean;
}

export function Brand({ compact = false, onDark = false }: BrandProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-3.5">
            <BrandMark className={compact ? 'size-12 rounded-xl' : 'size-16 rounded-2xl'} />
            <div className="min-w-0">
                <p
                    className={cn(
                        'font-heading font-extrabold tracking-tight',
                        compact ? 'text-xl' : 'text-2xl',
                        onDark ? 'text-white' : 'text-foreground',
                    )}
                >
                    {t('brand.name')}
                </p>
                <p className={cn('mt-0.5 text-xs', onDark ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
                    {t('brand.tagline')}
                </p>
            </div>
        </div>
    );
}
