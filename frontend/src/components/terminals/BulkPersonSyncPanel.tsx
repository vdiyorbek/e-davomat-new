import { useId, useState } from 'react';
import { ListChecks, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authorizedPost } from '@/lib/auth-session';

type SyncType = 'STUDENT' | 'TEACHER' | 'BOTH';

interface BulkSyncResponse {
    success: boolean;
    dryRun: boolean;
    type: SyncType;
    results: Array<{
        terminalId: number;
        schoolId: number;
        candidates: number;
        hasMore: boolean;
        queued: number;
        reused: number;
        failed: number;
    }>;
}

interface Props {
    terminalIds: number[];
    onSubmitted?: () => void;
}

const MAX_TERMINALS = 5;
const LIMITS = [1, 5, 10, 20];

export function BulkPersonSyncPanel({ terminalIds, onSubmitted }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [type, setType] = useState<SyncType>('BOTH');
    const [limit, setLimit] = useState(10);
    const [preview, setPreview] = useState<BulkSyncResponse | null>(null);
    const [previewIds, setPreviewIds] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<BulkSyncResponse | null>(null);

    const tooMany = terminalIds.length > MAX_TERMINALS;
    const canApply =
        preview !== null &&
        previewIds.join(',') === terminalIds.join(',') &&
        terminalIds.length > 0 &&
        !tooMany;

    async function submit(dryRun: boolean) {
        if (busy || terminalIds.length === 0) return;
        setBusy(true);
        setError('');
        try {
            const response = await authorizedPost<BulkSyncResponse>('/terminals/bulk/person-sync', {
                terminalIds,
                type,
                limitPerTerminal: limit,
                dryRun,
                ...(dryRun ? {} : { confirm: 'SYNC_SELECTED_PERSONS' }),
            });
            if (dryRun) {
                setPreview(response);
                setPreviewIds([...terminalIds]);
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
                            setPreview(null);
                        }}
                        options={(['BOTH', 'STUDENT', 'TEACHER'] as const).map((value) => ({
                            value,
                            label: t(`terminals.personSync.types.${value}`),
                        }))}
                    />
                </Field>
                <Field htmlFor={`${id}-limit`} label={t('terminals.personSync.limit')}>
                    <SelectField
                        id={`${id}-limit`}
                        value={String(limit)}
                        onValueChange={(value) => {
                            setLimit(Number(value));
                            setPreview(null);
                        }}
                        options={LIMITS.map((value) => ({
                            value: String(value),
                            label: t('terminals.personSync.limitOption', { count: value }),
                        }))}
                    />
                </Field>
            </div>

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
                <div className="space-y-2 rounded-xl border border-success/30 bg-success/8 p-4 text-sm">
                    {result.results.map((item) => (
                        <p key={item.terminalId} className="tabular-nums">
                            <span className="font-semibold">#{item.terminalId}</span>{' '}
                            {t('terminals.personSync.result', {
                                queued: item.queued,
                                reused: item.reused,
                                failed: item.failed,
                            })}
                        </p>
                    ))}
                    <p className="text-xs text-muted-foreground">{t('terminals.personSync.resultNote')}</p>
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
