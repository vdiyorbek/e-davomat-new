import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime } from '@/lib/date';

import { StatTile } from './StatTile';

interface Capacity {
    registeredPersons: number;
    maxPersons: number | null;
    availableSlots: number | null;
    checkedAt: string;
}

interface FaceCount {
    supported: boolean;
    faceRecords: number | null;
    checkedAt: string;
}

/**
 * Terminalning O‘ZIDAGI ma’lumot (jonli so‘rov, faqat o‘qiydi): nechta shaxs yuklangan,
 * nechtasining yuz rasmi bor/yo‘q va qancha joy qolgan.
 */
export function TerminalDeviceData({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const capacity = useApiQuery<Capacity>(`/terminals/${terminalId}/person-sync/capacity`);
    const faces = useApiQuery<FaceCount>(`/terminals/${terminalId}/person-sync/face-count`);

    const loading = capacity.loading || faces.loading;
    const error = capacity.error || faces.error;
    const persons = capacity.data?.registeredPersons ?? null;
    const faceCount = faces.data?.supported ? (faces.data.faceRecords ?? null) : null;
    const withoutFace = persons !== null && faceCount !== null ? Math.max(persons - faceCount, 0) : null;
    const checkedAt = capacity.data?.checkedAt ?? faces.data?.checkedAt ?? null;

    function refresh() {
        capacity.retry();
        faces.retry();
    }

    return (
        <section className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t('terminals.deviceData.title')}</h3>
                <Button type="button" size="sm" variant="outline" disabled={loading} onClick={refresh}>
                    <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
                    {t('terminals.deviceData.refresh')}
                </Button>
            </div>

            {loading && !capacity.data ? (
                <LoadingState rows={2} label={t('terminals.deviceData.loading')} />
            ) : error && persons === null ? (
                <ErrorState message={error} onRetry={refresh} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile label={t('terminals.deviceData.loaded')} value={persons ?? '—'} />
                        <StatTile label={t('terminals.deviceData.withFace')} value={faceCount ?? '—'} tone={faceCount !== null ? 'success' : undefined} />
                        <StatTile
                            label={t('terminals.deviceData.withoutFace')}
                            value={withoutFace ?? '—'}
                            tone={withoutFace !== null && withoutFace > 0 ? 'danger' : undefined}
                        />
                        <StatTile
                            label={t('terminals.deviceData.free')}
                            value={capacity.data?.availableSlots ?? '—'}
                        />
                    </div>

                    {withoutFace !== null && withoutFace > 0 && (
                        <p className="flex items-start gap-2 text-sm text-destructive">
                            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            {t('terminals.deviceData.warning', { count: withoutFace })}
                        </p>
                    )}
                    {faces.data && !faces.data.supported && (
                        <p className="text-xs text-muted-foreground">{t('terminals.deviceData.unsupported')}</p>
                    )}
                    {error && persons !== null && <p className="text-xs text-destructive">{error}</p>}
                    <p className="text-xs text-muted-foreground">
                        {t('terminals.deviceData.note')}
                        {checkedAt && ` ${t('terminals.deviceData.checkedAt', { time: formatDateTime(checkedAt) })}`}
                    </p>
                </>
            )}
        </section>
    );
}
