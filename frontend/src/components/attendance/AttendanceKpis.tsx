import { CalendarOff, ChartNoAxesColumn, CircleCheck, CircleX, FileCheck2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { KpiCard } from '@/components/common/KpiCard';
import type { KpiTone } from '@/components/common/KpiCard';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatNumber, todayInTashkent } from '@/lib/date';
import type { AttendanceSummary } from '@/types/attendance-summary';

interface Props {
    mode: 'students' | 'teachers';
    date: string;
    regionId: string;
    districtId: string;
    schoolId: string;
    classId: string;
    /** Joriy holat filtri: bosilgan karta ajratib ko‘rsatiladi. */
    status: string;
    onStatusChange: (status: string) => void;
}

/**
 * Ro‘yxat ustidagi ko‘rsatkichlar: hududlar kesimidagi hisob bilan bir
 * xil (kalendar va sababli arizalar hisobga olinadi). Kartani bosish
 * jadvalni shu holat bo‘yicha filtrlaydi.
 */
export function AttendanceKpis({ mode, date, regionId, districtId, schoolId, classId, status, onStatusChange }: Props) {
    const { t } = useTranslation();

    const params = new URLSearchParams({
        membershipType: mode === 'students' ? 'STUDENT' : 'TEACHER',
        from: date,
        to: date,
    });
    if (regionId) params.set('regionId', regionId);
    if (districtId) params.set('districtId', districtId);
    if (schoolId) params.set('schoolId', schoolId);
    if (classId && mode === 'students') params.set('classId', classId);

    const { data, loading, retry } = useApiQuery<AttendanceSummary>(`/daily-attendance/summary?${params.toString()}`);

    // Bugungi kun uchun har daqiqada yangilanadi.
    useInterval(retry, date === todayInTashkent() ? 60_000 : null);

    const totals = data?.totals;
    const rateTone: KpiTone =
        totals?.band === 'LOW' ? 'danger' : totals?.band === 'MEDIUM' ? 'warning' : totals?.band === 'HIGH' ? 'success' : 'neutral';

    const cards: {
        key: string;
        value: number | string;
        icon: typeof Users;
        tone: KpiTone;
        filter?: string;
    }[] = [
        { key: 'persons', value: totals?.persons ?? 0, icon: Users, tone: 'primary', filter: '' },
        { key: 'present', value: totals?.present ?? 0, icon: CircleCheck, tone: 'success', filter: 'inside' },
        { key: 'absent', value: totals?.absent ?? 0, icon: CircleX, tone: 'danger', filter: 'absent' },
        { key: 'excused', value: totals?.excused ?? 0, icon: FileCheck2, tone: 'primary', filter: 'excused' },
        { key: 'dayOff', value: totals?.dayOff ?? 0, icon: CalendarOff, tone: 'neutral' },
        {
            key: 'rate',
            value: totals?.rate == null ? '—' : `${formatNumber(totals.rate)}%`,
            icon: ChartNoAxesColumn,
            tone: rateTone,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
                <KpiCard
                    key={card.key}
                    label={t(`attendanceSummary.kpi.${card.key}`)}
                    value={card.value}
                    icon={card.icon}
                    tone={card.tone}
                    loading={loading}
                    {...(card.filter !== undefined
                        ? {
                              onClick: () => onStatusChange(status === card.filter ? '' : card.filter!),
                              active: card.filter !== '' && status === card.filter,
                          }
                        : {})}
                />
            ))}
        </div>
    );
}
