import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface BrandProps {
    compact?: boolean;
    /** Qorong'i (navy) fon ustida ishlatilsa true */
    onDark?: boolean;
}

export function Brand({ compact = false, onDark = false }: BrandProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-4">
            <div
                className={cn(
                    'shrink-0 overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-black/5',
                    compact ? 'size-14' : 'size-20',
                )}
            >
                <img src="/logotip.jpg" alt={t('brand.name')} className="h-full w-full object-contain" />
            </div>
            <div>
                <p
                    className={cn(
                        'font-bold tracking-tight',
                        compact ? 'text-xl' : 'text-2xl',
                        onDark ? 'text-white' : 'text-foreground',
                    )}
                >
                    {t('brand.name')}
                </p>
                <p className={cn('mt-1 text-xs', onDark ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
                    {t('brand.tagline')}
                </p>
            </div>
        </div>
    );
}
