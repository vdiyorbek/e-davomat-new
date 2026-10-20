import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
    title: ReactNode;
    description?: ReactNode;
    confirmLabel?: ReactNode;
    destructive?: boolean;
}

/**
 * `window.confirm` o‘rniga shadcn AlertDialog.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: '…' }))) return;
 *   …
 *   return <>{dialog} …</>;
 */
export function useConfirm() {
    const { t } = useTranslation();
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((next: ConfirmOptions) => {
        setOptions(next);
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    function settle(value: boolean) {
        resolver.current?.(value);
        resolver.current = null;
        setOptions(null);
    }

    const dialog = (
        <AlertDialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                    {options?.description && (
                        <AlertDialogDescription>{options.description}</AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => settle(false)}>
                        {t('common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant={options?.destructive ? 'destructive' : 'default'}
                        onClick={() => settle(true)}
                    >
                        {options?.confirmLabel ?? t('common.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, dialog };
}
