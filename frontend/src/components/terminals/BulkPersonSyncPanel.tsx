import { useId, useState } from 'react';
import { ExternalLink, ListChecks, Send } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';
import { formatNumber } from '@/lib/date';

type SyncType = 'STUDENT' | 'TEACHER' | 'BOTH';
type SyncMode = 'ALL' | 'LIMITED';

interface BulkSyncResponse {
    success: boolean;
    dryRun: boolean;
    type: SyncType;
    mode: SyncMode;
    batchId: string | null;
    results: Array<{
        terminalId: number;
        schoolId: number;
        candidates: number;
        hasMore: boolean;
        queued: number;
        reused: number;
        failed: number;
        scheduled?: number;
    }>;
}

interface Props {
    terminalIds: number[];
    onSubmitted?: () => void;
}

const MAX_TERMINALS = 5;
const LIMITS = [1, 5, 10, 20];

/**
 * Tanlangan terminallarga maktabdagi shaxslarni yuborish.
 *
 * «ALL» rejimida maktabdagi barcha faol o‘quvchi/o‘qituvchilar bitta
 * topshiriq (batch) sifatida saqlanadi. Backend dispatcher ularni har
 * terminalga ketma-ket yuboradi; bajarilishini «Sinxronlash tarixi»da
 * kuzatish mumkin. «LIMITED» — faqat sinov uchun.
 */
export function BulkPersonSyncPanel({ terminalIds, onSubmitted }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [type, setType] = useState<SyncType>('BOTH');
    const [mode, setMode] = useState<SyncMode>('ALL');
    const [limit, setLimit] = useState(10);
    const [preview, setPreview] = useState<BulkSyncResponse | null>(null);
    const [previewSignature, setPreviewSignature] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<BulkSyncResponse | null>(null);

    const tooMany = terminalIds.length > MAX_TERMINALS;
    const currentSignature = JSON.stringify({
        terminalIds: [...terminalIds].sort((a, b) => a - b),
        type,
        mode,
        limit: mode === 'LIMITED' ? limit : null,
    });

    // Oldindan ko‘rilgan reja joriy tanlovga mos bo‘lsagina tasdiqlash mumkin.
    // LIMITED rejimida `hasMore` tabiiy holat (sinov uchun bir qismi
    // yuboriladi), shuning uchun u tasdiqlashni to‘smaydi.
    const totalCandidates = preview?.results.reduce((sum, item) => sum + item.candidates, 0) ?? 0;
    const canApply =
        preview !== null &&
        previewSignature === currentSignature &&
        terminalIds.length > 0 &&
        !tooMany &&
        totalCandidates > 0;

    function resetPlan() {
        setPreview(null);
        setResult(null);
    }

    async function submit(dryRun: boolean) {
        if (busy || terminalIds.length === 0) return;
        setBusy(true);
        setError('');
        try {
            const response = await authorizedPost<BulkSyncResponse>('/terminals/bulk/person-sync', {
                terminalIds,
                type,
                mode,
                ...(mode === 'LIMITED' ? { limitPerTerminal: limit } : {}),
                dryRun,
                ...(dryRun ? {} : { confirm: 'SYNC_SELECTED_PERSONS' }),
            });
            if (dryRun) {
                setPreview(response);
                setPreviewSignature(currentSignature);
                setResult(null);
            } else {
                setResult(response);
                setPreview(null);
                onSubmitted?.();
            }
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.personSync.failed'));
        } finally {
            setBusy(false);
        }
    }

    const scheduledTotal = result?.results.reduce((sum, item) => sum + (item.scheduled ?? item.candidates), 0) ?? 0;

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold">{t('terminals.personSync.title')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t('terminals.personSync.hint')}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <Field htmlFor={`${id}-type`} label={t('terminals.personSync.type')}>
                    <SelectField
                        id={`${id}-type`}
                        value={type}
                        onValueChange={(value) => {
                            setType(value as SyncType);
                            resetPlan();
                        }}
                        options={(['BOTH', 'STUDENT', 'TEACHER'] as const).map((value) => ({
                            value,
                            label: t(`terminals.personSync.types.${value}`),
                        }))}
                    />
                </Field>
                <Field htmlFor={`${id}-mode`} label={t('terminals.personSync.mode')}>
                    <SelectField
                        id={`${id}-mode`}
                        value={mode}
                        onValueChange={(value) => {
                            setMode(value === 'LIMITED' ? 'LIMITED' : 'ALL');
                            resetPlan();
                        }}
                        options={(['ALL', 'LIMITED'] as const).map((value) => ({
                            value,
                            label: t(`terminals.personSync.modes.${value}`),
                        }))}
                    />
                </Field>
                {mode === 'LIMITED' && (
                    <Field htmlFor={`${id}-limit`} label={t('terminals.personSync.limit')}>
                        <SelectField
                            id={`${id}-limit`}
                            value={String(limit)}
                            onValueChange={(value) => {
                                setLimit(Number(value));
                                resetPlan();
                            }}
                            options={LIMITS.map((value) => ({
                                value: String(value),
                                label: t('terminals.personSync.limitOption', { count: value }),
                            }))}
                        />
                    </Field>
                )}
            </div>

            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                {mode === 'ALL'
                    ? t('terminals.personSync.allNote')
                    : t('terminals.personSync.limitedNote', { count: limit })}
            </p>

            {tooMany && (
                <Alert variant="destructive">
                    <AlertDescription>{t('terminals.bulk.limitHint', { max: MAX_TERMINALS })}</AlertDescription>
                </Alert>
            )}

            <Button
                type="button"
                variant="outline"
                disabled={busy || terminalIds.length < 1 || tooMany}
                onClick={() => void submit(true)}
            >
                <ListChecks aria-hidden="true" />
                {busy && !preview ? t('terminals.personSync.checking') : t('terminals.personSync.preview')}
            </Button>

            {preview && (
                <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
                    <p className="text-sm font-semibold">{t('terminals.personSync.planTitle')}</p>
                    <ul className="divide-y rounded-lg border bg-card">
                        {preview.results.map((item) => (
                            <li key={item.terminalId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                <span className="font-medium">{t('terminals.bulk.terminal', { id: item.terminalId })}</span>
                                <span className="tabular-nums">
                                    {t('terminals.personSync.candidates', { count: item.candidates })}
                                    {item.hasMore && (
                                        <span className="text-muted-foreground"> · {t('terminals.personSync.hasMore')}</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">{t('terminals.personSync.planNote')}</p>
                    <Button type="button" disabled={!canApply || busy} onClick={() => void submit(false)}>
                        <Send aria-hidden="true" />
                        {busy ? t('terminals.personSync.applying') : t('terminals.personSync.apply')}
                    </Button>
                </div>
            )}

            {result && (
                <div className="space-y-3 rounded-xl border border-success/30 bg-success/8 p-4 text-sm">
                    <p className="font-semibold">
                        {result.batchId
                            ? t('terminals.personSync.queuedBatch', { id: result.batchId, count: formatNumber(scheduledTotal) })
                            : t('terminals.personSync.scheduled', { count: scheduledTotal })}
                    </p>
                    <ul className="space-y-1 text-xs">
                        {result.results.map((item) => (
                            <li key={item.terminalId} className="tabular-nums">
                                <span className="font-semibold">#{item.terminalId}</span> —{' '}
                                {t('terminals.personSync.scheduled', { count: item.scheduled ?? item.candidates })}
                            </li>
                        ))}
                    </ul>
                    <Button asChild size="sm" variant="outline" className="bg-background">
                        <Link
                            to={
                                result.batchId
                                    ? `/terminals/sync-history?tab=persons&batch=${result.batchId}`
                                    : '/terminals/sync-history?tab=persons'
                            }
                        >
                            <ExternalLink aria-hidden="true" />
                            {t('terminals.personSync.openHistory')}
                        </Link>
                    </Button>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </section>
    );
}
