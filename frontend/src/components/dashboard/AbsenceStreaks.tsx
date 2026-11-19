import { useState } from 'react';
import { UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import type { AbsenceStreaksPage, DashboardLevel } from '@/types/dashboard';

/** Ketma-ket 5 va undan ko‘p o‘quv kuni sababsiz kelmagan o‘quvchilar. */
export function AbsenceStreaks({ scopeQuery, level }: { scopeQuery: string; level: DashboardLevel }) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const query = useApiQuery<AbsenceStreaksPage>(`/dashboard/absence-streaks?${scopeQuery}&page=${page}&limit=10`);

    if (query.loading) return <LoadingState rows={3} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;
    if (query.data.total === 0) {
        return <EmptyState icon={UserX} title={t('dashboard.streaks.emptyTitle')} description={t('dashboard.streaks.empty')} />;
    }

    const showSchool = level !== 'SCHOOL';

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                    <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">{t('dashboard.streaks.student')}</th>
                            {showSchool && <th className="py-2 pr-3 font-medium">{t('common.school')}</th>}
                            <th className="py-2 pr-3 font-medium">{t('common.class')}</th>
                            <th className="py-2 pr-3 font-medium">{t('dashboard.streaks.mahalla')}</th>
                            <th className="py-2 text-right font-medium">{t('dashboard.streaks.days')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {query.data.data.map((row) => (
                            <tr key={`${row.school.id}-${row.personId}`} className="border-t">
                                <td className="py-2 pr-3 font-medium">
                                    {row.lastName} {row.firstName}
                                </td>
                                {showSchool && (
                                    <td className="py-2 pr-3">
                                        {row.school.name}
                                        <span className="block text-xs text-muted-foreground">{row.school.district}</span>
                                    </td>
                                )}
                                <td className="py-2 pr-3">{row.className}</td>
                                <td className="py-2 pr-3 text-muted-foreground">{row.mahalla ?? '—'}</td>
                                <td className="whitespace-nowrap py-2 text-right">
                                    <StatusBadge tone={row.days >= 10 ? 'danger' : 'warning'}>{t('dashboard.streaks.daysN', { count: row.days })}</StatusBadge>
                                    <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                        {t('dashboard.streaks.since', { date: formatDate(row.sinceDate) })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {query.data.totalPages > 1 && (
                <Pagination
                    page={query.data.page}
                    totalPages={query.data.totalPages}
                    onPageChange={setPage}
                    total={query.data.total}
                    pageSize={query.data.limit}
                    shownCount={query.data.data.length}
                    label={t('dashboard.streaks.title')}
                />
            )}
        </div>
    );
}
