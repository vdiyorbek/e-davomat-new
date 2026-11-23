import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authorizedGet } from '@/lib/auth-session';

/** Ro‘yxatni Excel (.xlsx) qilib yuklab oladi. `path` — filtrlar bilan, sahifalashsiz. */
export function ExportExcelButton({ path, filename }: { path: string; filename: string }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function run() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const blob = await authorizedGet<Blob>(path, undefined, 'blob', 120_000);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common.exportFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
                {busy ? t('common.exporting') : t('common.exportExcel')}
            </Button>
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
