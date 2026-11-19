import { CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, formatTime, weekdayIndex, weekdayName } from '@/lib/date';
import type { StudentAttendance } from '@/types/cabinet';
import { CircleCheck, CircleX, FileCheck2 } from 'lucide-react';

const TONE = { PRESENT: 'success', EXCUSED: 'info', ABSENT: 'danger' } as const;

export function StudentOwnAttendancePage() {
    const { t } = useTranslation();
    const query = useApiQuery<StudentAttendance>('/student/me/attendance');

    const days = query.data?.days ?? [];
    const count = (status: keyof typeof TONE) => days.filter((day) => day.status === status).length;

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('student.eyebrow')} title={t('student.attendance.title')} description={t('student.attendance.description')} />
            {query.loading && <LoadingState rows={6} />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {query.data && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <KpiCard icon={CircleCheck} tone="success" label={t('student.attendance.statuses.PRESENT')} value={count('PRESENT')} />
                        <KpiCard icon={FileCheck2} label={t('student.attendance.statuses.EXCUSED')} value={count('EXCUSED')} />
                        <KpiCard icon={CircleX} tone="danger" label={t('student.attendance.statuses.ABSENT')} value={count('ABSENT')} />
                    </div>
                    {days.length === 0 ? (
                        <EmptyState icon={CalendarCheck} title={t('student.attendance.emptyTitle')} description={t('student.attendance.empty')} />
                    ) : (
                        <Card className="divide-y py-0">
                            {days.map((day) => (
                                <div key={day.date} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <div className="min-w-32">
                                        <p className="font-medium tabular-nums">{formatDate(day.date)}</p>
                                        <p className="text-xs text-muted-foreground">{weekdayName(weekdayIndex(day.date))}</p>
                                    </div>
                                    <StatusBadge tone={TONE[day.status]}>{t(`student.attendance.statuses.${day.status}`)}</StatusBadge>
                                    <p className="ml-auto text-sm tabular-nums text-muted-foreground">
                                        {day.firstInTime && t('student.home.arrivedAt', { time: formatTime(day.firstInTime) })}
                                        {day.lastOutTime && ` · ${t('student.home.leftAt', { time: formatTime(day.lastOutTime) })}`}
                                    </p>
                                </div>
                            ))}
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
