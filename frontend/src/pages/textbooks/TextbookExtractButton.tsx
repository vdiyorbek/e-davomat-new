import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';

interface Props {
    textbookId: number;
    onExtracted: () => void;
}

export function TextbookExtractButton({ textbookId, onExtracted }: Props) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleExtract() {
        if (busy) return;
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const result = await authorizedPost<{ savedCount: number }>(`/textbooks/${textbookId}/extract-topics`, {}, 180_000);
            setSuccess(t('textbooks.extract.success', { count: result.savedCount }));
            onExtracted();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('textbooks.extract.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            <Button type="button" onClick={() => void handleExtract()} disabled={busy}>
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
                {busy ? t('textbooks.extract.busy') : t('textbooks.extract.button')}
            </Button>
            {busy && <p className="text-sm text-muted-foreground">{t('textbooks.extract.wait')}</p>}
            {error && <ErrorState message={error} />}
            {success && <SuccessNotice>{success}</SuccessNotice>}
        </div>
    );
}
