import { useState } from 'react';
import { FilePlus2, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExportExcelButton } from '@/components/common/ExportExcelButton';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { GuardianLinks } from '@/components/homeroom/GuardianLinks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomAbsentees } from '@/types/homeroom';

/** Ketma-ket kelmayotgan o‘quvchilar va ota-ona telefonlari. */
export function AbsenteesTab({ classId, onExcuse }: { classId: number; onExcuse: (personId: number) => void }) {
    const { t } = useTranslation();
    const [minDays, setMinDays] = useState('2');
    const { data, loading, error, retry } = useApiQuery<HomeroomAbsentees>(`/homeroom/classes/${classId}/absentees?minDays=${minDays}`);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="w-52">
                    <SelectField
                        value={minDays}
                        onValueChange={setMinDays}
                        aria-label={t('homeroom.absentees.minDays')}
                        options={['1', '2', '3', '5'].map((value) => ({ value, label: t('homeroom.absentees.minDaysN', { count: Number(value) }) }))}
                    />
                </div>
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t('homeroom.absentees.hint')}</p>
                <ExportExcelButton
                    path={`/homeroom/classes/${classId}/absentees/export?minDays=${minDays}`}
                    filename={`kelmayotgan-oquvchilar-${todayInTashkent()}.xlsx`}
                />
            </div>

            {loading ? (
                <LoadingState />
            ) : error || !data ? (
                <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
            ) : data.data.length === 0 ? (
                <EmptyState icon={UserRoundCheck} title={t('homeroom.absentees.emptyTitle')} description={t('homeroom.absentees.empty')} />
            ) : (
                <ul className="grid list-none gap-3 md:grid-cols-2">
                    {data.data.map((row) => (
                        <li key={row.personId}>
                            <Card size="sm" className="h-full gap-3 px-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold [overflow-wrap:anywhere]">{personFullName(row)}</p>
                                        {row.sinceDate && (
                                            <p className="text-xs text-muted-foreground tabular-nums">{t('dashboard.streaks.since', { date: formatDate(row.sinceDate) })}</p>
                                        )}
                                    </div>
                                    <StatusBadge tone={row.days >= 5 ? 'danger' : 'warning'}>{t('dashboard.streaks.daysN', { count: row.days })}</StatusBadge>
                                </div>
                                <GuardianLinks guardians={row.guardians} />
                                <div className="mt-auto flex justify-end border-t pt-3">
                                    <Button type="button" size="sm" variant="outline" onClick={() => onExcuse(row.personId)}>
                                        <FilePlus2 aria-hidden="true" />
                                        {t('homeroom.excuses.submit')}
                                    </Button>
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
