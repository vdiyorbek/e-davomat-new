import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date';
import { checkTerminal } from '@/lib/terminals-api';
import type { TerminalCheckResponse } from '@/types/terminal';

export function CheckTerminalButton({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const busyRef = useRef(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<TerminalCheckResponse | null>(null);
    const [error, setError] = useState('');

    async function handleCheck() {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setResult(null);
        setError('');
        try {
            setResult(await checkTerminal(terminalId));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('terminals.check.failed'));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void handleCheck()} className="w-full">
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <PlugZap aria-hidden="true" />}
                {busy ? t('terminals.check.checking') : t('terminals.check.button')}
            </Button>

            {error && (
                <Alert variant="destructive">
                    <XCircle aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {result && (
                <Alert variant={result.success ? 'success' : 'destructive'}>
                    {result.success ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                    <AlertTitle className="line-clamp-none">{result.message}</AlertTitle>
                    <AlertDescription>
                        {result.success && (
                            <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                <dt className="font-semibold">{t('terminals.model')}</dt>
                                <dd className="[overflow-wrap:anywhere]">{result.model}</dd>
                                <dt className="font-semibold">{t('terminals.serial')}</dt>
                                <dd className="break-all">{result.serialNumber}</dd>
                                <dt className="font-semibold">{t('terminals.firmware')}</dt>
                                <dd>{result.firmwareVersion || t('terminals.unknown')}</dd>
                            </dl>
                        )}
                        <p className="text-xs opacity-80">
                            {t('terminals.check.time', { time: formatDateTime(result.checkedAt) })}
                        </p>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
