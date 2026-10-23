import { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { authorizedPatch } from '@/lib/auth-session';

interface Props {
    textbook: { id: number; title: string; isActive: boolean };
    onUpdated: () => void;
}

/** Darslikni arxivlash yoki arxivdan qaytarish (ma’lumot va PDF o‘chirilmaydi). */
export function TextbookArchiveButton({ textbook, onUpdated }: Props) {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const archived = !textbook.isActive;

    async function handleAction() {
        if (busy) return;
        setError('');
        const confirmed = await confirm({
            title: archived ? t('textbooks.archive.restoreTitle') : t('textbooks.archive.archiveTitle'),
            description: archived
                ? t('textbooks.archive.restoreConfirm', { title: textbook.title })
                : t('textbooks.archive.archiveConfirm', { title: textbook.title }),
            confirmLabel: archived ? t('textbooks.archive.restore') : t('textbooks.archive.archive'),
            destructive: !archived,
        });
        if (!confirmed) return;

        setBusy(true);
        try {
            await authorizedPatch(`/textbooks/${textbook.id}`, { isActive: archived });
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('textbooks.archive.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {dialog}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void handleAction()}
                className={archived ? undefined : 'text-destructive hover:text-destructive'}
            >
                {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                {busy ? t('common.saving') : archived ? t('textbooks.archive.restore') : t('textbooks.archive.archive')}
            </Button>
            {error && (
                <p role="alert" className="basis-full text-sm text-destructive">
                    {error}
                </p>
            )}
        </>
    );
}
