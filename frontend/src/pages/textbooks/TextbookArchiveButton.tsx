
import { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { authorizedPatch } from '@/lib/auth-session';

interface Props {
    textbook: {
        id: number;
        title: string;
        isActive: boolean;
    };
    onUpdated: () => void;
}

export function TextbookArchiveButton({
    textbook,
    onUpdated,
}: Props) {
    const { confirm, dialog } = useConfirm();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const archived = !textbook.isActive;

    async function handleAction() {
        if (busy) return;

        setError('');

        const confirmed = await confirm({
            title: archived
                ? 'Darslikni qayta tiklash'
                : 'Darslikni arxivlash',

            description: archived
                ? `"${textbook.title}" darsligini qayta faollashtirmoqchimisiz?`
                : `"${textbook.title}" darsligi arxivga o'tkaziladi. Ma'lumotlar va PDF fayl o'chirilmaydi.`,

            confirmLabel: archived
                ? 'Qayta tiklash'
                : 'Arxivlash',

            destructive: !archived,
        });

        if (!confirmed) return;

        setBusy(true);

        try {
            await authorizedPatch(
                `/textbooks/${textbook.id}`,
                {
                    isActive: archived,
                },
            );

            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Amalni bajarishda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {dialog}

            <div className="flex flex-col gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleAction()}
                    className={
                        archived
                            ? ''
                            : 'text-destructive hover:text-destructive'
                    }
                >
                    {archived ? (
                        <ArchiveRestore aria-hidden="true" />
                    ) : (
                        <Archive aria-hidden="true" />
                    )}

                    {busy
                        ? 'Bajarilmoqda...'
                        : archived
                            ? 'Qayta tiklash'
                            : 'Arxivlash'}
                </Button>

                {error && (
                    <ErrorState message={error} />
                )}
            </div>
        </>
    );
}
