import { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { formatNumber } from '@/lib/date';

type Gap = 'PHOTO' | 'GUARDIAN';

interface GapRow {
    schoolId: number;
    school: string;
    district: string;
    students: number;
    noPhoto: number;
    noGuardian: number;
    photoSent: boolean;
    guardianSent: boolean;
}

type NotifyResult = {
    sent: number;
    skippedOpen: number;
    skippedNoAdmin: number;
};

/** Ma’lumoti to‘liq emas maktablar va maktab administratoriga bir tugma bilan eslatma. */
export function DataGapsCard({ onSent }: { onSent: () => void }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<GapRow[]>('/announcements/data-gaps');
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState('');
    const [failure, setFailure] = useState('');

    async function notify(gap: Gap, schoolId?: number) {
        if (busy) return;
        setBusy(`${gap}:${schoolId ?? 'all'}`);
        setNotice('');
        setFailure('');
        try {
            const result = await authorizedPost<NotifyResult>('/announcements/data-gaps/notify', {
                gap,
                ...(schoolId ? { schoolIds: [schoolId] } : {}),
            });
            setNotice(t('announcements.gaps.result', result));
            retry();
            onSent();
        } catch (err: unknown) {
            setFailure(err instanceof Error ? err.message : t('announcements.errors.failed'));
        } finally {
            setBusy(null);
        }
    }

    function cell(count: number, sent: boolean, gap: Gap, schoolId: number) {
        if (count === 0) return <span className="text-muted-foreground">0</span>;
        return (
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
                {sent ? (
                    <StatusBadge tone="success" dot={false}>
                        <Check aria-hidden="true" className="size-3" />
                        {t('announcements.gaps.sent')}
                    </StatusBadge>
                ) : (
                    <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void notify(gap, schoolId)}>
                        <BellRing aria-hidden="true" />
                        {t('announcements.gaps.remind')}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <Card className="gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-heading text-lg font-bold">{t('announcements.gaps.title')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('announcements.gaps.description')}</p>
                </div>
                {data && data.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void notify('PHOTO')}>
                            <BellRing aria-hidden="true" />
                            {t('announcements.gaps.allPhoto')}
                        </Button>
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void notify('GUARDIAN')}>
                            <BellRing aria-hidden="true" />
                            {t('announcements.gaps.allGuardian')}
                        </Button>
                    </div>
                )}
            </div>

            {notice && <p role="status" className="text-sm text-success">{notice}</p>}
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}

            {loading && !data ? (
                <LoadingState rows={3} />
            ) : error && !data ? (
                <ErrorState message={error} onRetry={retry} />
            ) : data && data.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('announcements.gaps.empty')}</p>
            ) : data ? (
                <div className="max-h-96 overflow-auto rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">{t('announcements.gaps.school')}</TableHead>
                                <TableHead>{t('announcements.gaps.students')}</TableHead>
                                <TableHead>{t('announcements.gaps.noPhoto')}</TableHead>
                                <TableHead className="pr-4">{t('announcements.gaps.noGuardian')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.schoolId}>
                                    <TableCell className="pl-4 whitespace-normal">
                                        <span className="font-medium [overflow-wrap:anywhere]">{row.school}</span>
                                        <span className="block text-xs text-muted-foreground">{row.district}</span>
                                    </TableCell>
                                    <TableCell className="tabular-nums">{formatNumber(row.students)}</TableCell>
                                    <TableCell>{cell(row.noPhoto, row.photoSent, 'PHOTO', row.schoolId)}</TableCell>
                                    <TableCell className="pr-4">{cell(row.noGuardian, row.guardianSent, 'GUARDIAN', row.schoolId)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : null}
        </Card>
    );
}
