import { FileCheck2, FilePlus2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PdfPreview } from '@/components/attendance/AttendanceExcuseActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, formatDateTime } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomExcuse } from '@/types/homeroom';

const TONE = { ACTIVE: 'success', PENDING: 'warning', REJECTED: 'danger', CANCELLED: 'neutral' } as const;

/** Sinf arizalari: kutilmoqda, tasdiqlangan, rad etilgan. */
export function ExcusesTab({ classId, reloadKey, onNew }: { classId: number; reloadKey: number; onNew: () => void }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<HomeroomExcuse[]>(`/homeroom/classes/${classId}/excuses?v=${reloadKey}`);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-muted-foreground">{t('homeroom.excuses.flow')}</p>
                <Button type="button" onClick={onNew}>
                    <FilePlus2 aria-hidden="true" />
                    {t('homeroom.excuses.new')}
                </Button>
            </div>

            {loading ? (
                <LoadingState />
            ) : error || !data ? (
                <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
            ) : data.length === 0 ? (
                <EmptyState icon={FileCheck2} title={t('excuses.emptyTitle')} description={t('homeroom.excuses.empty')} />
            ) : (
                <ul className="grid list-none gap-3 lg:grid-cols-2">
                    {data.map((item) => (
                        <li key={item.id}>
                            <Card size="sm" className="h-full gap-3 px-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold [overflow-wrap:anywhere]">{personFullName(item.person)}</p>
                                        <p className="text-sm text-muted-foreground tabular-nums">
                                            {formatDate(item.startDate)}
                                            {item.startDate !== item.endDate && ` — ${formatDate(item.endDate)}`}
                                        </p>
                                    </div>
                                    <StatusBadge tone={TONE[item.status]}>{t(`excuses.status.${item.status}`)}</StatusBadge>
                                </div>
                                <p className="text-sm">
                                    {t(`excuses.reason.${item.reason}`)}
                                    {item.reasonNote && <span className="text-muted-foreground"> · {item.reasonNote}</span>}
                                </p>
                                {item.status === 'REJECTED' && item.rejectionReason && (
                                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive [overflow-wrap:anywhere]">
                                        {t('excuses.rejectedReason', { reason: item.rejectionReason })}
                                    </p>
                                )}
                                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</span>
                                    <PdfPreview excuseId={item.id} pdfPath={`/homeroom/excuses/${item.id}/pdf`} />
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
