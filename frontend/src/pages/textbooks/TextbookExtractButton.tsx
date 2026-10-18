
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';

interface Props {
    textbookId: number;
    onExtracted: () => void;
}

export function TextbookExtractButton({
    textbookId,
    onExtracted,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleExtract() {
        if (busy) return;

        setBusy(true);
        setError('');
        setSuccess('');

        try {
            const result = await authorizedPost<{
                savedCount: number;
            }>(
                `/textbooks/${textbookId}/extract-topics`,
                {},
                180_000,
            );

            setSuccess(
                `${result.savedCount} ta mavzu ajratildi va tekshirish uchun saqlandi.`,
            );

            onExtracted();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Gemini tahlilida xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            <Button
                type="button"
                onClick={() => void handleExtract()}
                disabled={busy}
            >
                <Sparkles className="size-4" />
                {busy
                    ? 'Gemini PDF’ni tahlil qilmoqda…'
                    : 'Gemini orqali mavzularni ajratish'}
            </Button>

            {busy && (
                <p className="text-sm text-muted-foreground">
                    Tahlil biroz vaqt olishi mumkin. Sahifani yopmang.
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {success && (
                <p role="status" className="text-sm text-green-600">
                    {success}
                </p>
            )}
        </div>
    );
}
