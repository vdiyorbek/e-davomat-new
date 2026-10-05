import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { checkTerminal } from '@/lib/terminals-api';

import type { TerminalCheckResponse } from '@/types/terminal';

interface CheckTerminalButtonProps {
    terminalId: number;
}

export function CheckTerminalButton({
    terminalId,
}: CheckTerminalButtonProps) {
    const busyRef = useRef(false);

    const [busy, setBusy] = useState(false);
    const [result, setResult] =
        useState<TerminalCheckResponse | null>(null);
    const [error, setError] = useState('');

    async function handleCheck() {
        if (busyRef.current) return;

        busyRef.current = true;
        setBusy(true);
        setResult(null);
        setError('');

        try {
            const response = await checkTerminal(terminalId);
            setResult(response);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Tekshiruv so‘rovini bajarib bo‘lmadi.',
            );
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3 border-t pt-4">
            <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={handleCheck}
                className="w-full"
            >
                {busy ? 'Tekshirilmoqda…' : 'Ulanishni tekshirish'}
            </Button>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {result && (
                <div
                    role="status"
                    className={
                        result.success
                            ? 'space-y-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200'
                            : 'space-y-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive'
                    }
                >
                    <p>{result.message}</p>

                    {result.success && (
                        <dl className="space-y-2">
                            <div>
                                <dt className="font-medium">Model</dt>
                                <dd className="break-words">
                                    {result.model}
                                </dd>
                            </div>

                            <div>
                                <dt className="font-medium">
                                    Seriya raqami
                                </dt>
                                <dd className="break-all">
                                    {result.serialNumber}
                                </dd>
                            </div>

                            <div>
                                <dt className="font-medium">Firmware</dt>
                                <dd>
                                    {result.firmwareVersion || 'Noma’lum'}
                                </dd>
                            </div>
                        </dl>
                    )}

                    <p className="text-xs">
                        Tekshiruv vaqti:{' '}
                        {new Intl.DateTimeFormat('uz-UZ', {
                            timeZone: 'Asia/Tashkent',
                            dateStyle: 'short',
                            timeStyle: 'medium',
                        }).format(new Date(result.checkedAt))}
                    </p>
                </div>
            )}
        </div>
    );
}