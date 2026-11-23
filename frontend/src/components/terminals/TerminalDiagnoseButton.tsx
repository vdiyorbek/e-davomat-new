import { useRef, useState } from 'react';
import { CircleCheck, CircleX, Loader2, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';

type Data = Record<string, string | number | boolean | null>;

interface Step {
    key: 'connection' | 'time' | 'audio';
    ok: boolean;
    message: string | null;
    data: Data;
}

interface DiagnoseResult {
    checkedAt: string;
    durationMs: number;
    steps: Step[];
}

/** Terminalni qo‘lda tekshirish: ulanish, soat farqi, audio. Faqat o‘qiydi. */
export function TerminalDiagnoseButton({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const busyRef = useRef(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<DiagnoseResult | null>(null);
    const [error, setError] = useState('');

    async function run() {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setResult(null);
        setError('');
        try {
            setResult(await authorizedPost<DiagnoseResult>(`/terminals/${terminalId}/diagnose`, {}, 90_000));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.diagnose.failed'));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    function describe(step: Step): { ok: boolean; text: string } {
        if (!step.ok) return { ok: false, text: step.message ?? t('terminals.diagnose.failed') };
        const d = step.data;
        if (step.key === 'connection') {
            return {
                ok: true,
                text: t('terminals.diagnose.connectionOk', { model: String(d.model ?? '—'), firmware: String(d.firmware ?? '—') }),
            };
        }
        if (step.key === 'time') {
            const seconds = typeof d.differenceSeconds === 'number' ? d.differenceSeconds : null;
            if (seconds === null) return { ok: false, text: t('terminals.diagnose.timeUnknown') };
            const abs = Math.abs(seconds);
            if (abs <= 5) return { ok: true, text: t('terminals.diagnose.timeSynced', { seconds }) };
            return { ok: false, text: t(abs <= 30 ? 'terminals.diagnose.timeWarn' : 'terminals.diagnose.timeCrit', { seconds }) };
        }
        return d.supported
            ? { ok: true, text: d.channels ? t('terminals.diagnose.audioYes', { channels: String(d.channels) }) : t('terminals.diagnose.audioYesNoInfo') }
            : { ok: false, text: t('terminals.diagnose.audioNo') };
    }

    const shown = result
        ? (['connection', 'time', 'audio'] as const).map((key) => result.steps.find((step) => step.key === key) ?? null)
        : [];

    return (
        <div className="space-y-3">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run()} className="w-full">
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Stethoscope aria-hidden="true" />}
                {busy ? t('terminals.diagnose.running') : t('terminals.diagnose.button')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('terminals.diagnose.hint')}</p>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {result && (
                <div className="space-y-2 rounded-lg border bg-card p-3">
                    <ul className="list-none space-y-2">
                        {(['connection', 'time', 'audio'] as const).map((key, index) => {
                            const step = shown[index];
                            const info = step ? describe(step) : null;
                            const Icon = info?.ok ? CircleCheck : CircleX;
                            return (
                                <li key={key} className="flex items-start gap-2.5 text-sm">
                                    {info ? (
                                        <Icon aria-hidden="true" className={info.ok ? 'mt-0.5 size-4 shrink-0 text-success' : 'mt-0.5 size-4 shrink-0 text-destructive'} />
                                    ) : (
                                        <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-semibold">{t(`terminals.diagnose.steps.${key}`)}</p>
                                        <p className="text-muted-foreground [overflow-wrap:anywhere]">
                                            {info ? info.text : t('terminals.diagnose.skipped')}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="border-t pt-2 text-xs text-muted-foreground">{t('terminals.diagnose.done', { ms: result.durationMs })}</p>
                </div>
            )}
        </div>
    );
}
