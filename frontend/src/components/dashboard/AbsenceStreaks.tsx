import { useState } from 'react';
import { ArrowRight, UserX } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import type { AbsenceStreaksPage, DashboardLevel } from '@/types/dashboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Ketma-ket 5 va undan ko‘p o‘quv kuni sababsiz kelmagan o‘quvchilar. */
export function AbsenceStreaks({
    scopeQuery,
    level,
    limit = 5,
    viewAllTo,
}: {
    scopeQuery: string;
    level: DashboardLevel;
    limit?: number;
    /** Berilsa va natija bir sahifadan ko‘p bo‘lsa, «Hammasini ko‘rish» havolasi chiqadi. */
    viewAllTo?: string;
}) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const query = useApiQuery<AbsenceStreaksPage>(`/dashboard/absence-streaks?${scopeQuery}&page=${page}&limit=${limit}`);

    if (query.loading) return <LoadingState rows={3} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;
    if (query.data.total === 0) {
        return <EmptyState icon={UserX} title={t('dashboard.streaks.emptyTitle')} description={t('dashboard.streaks.empty')} />;
    }

    const showSchool = level !== 'SCHOOL';

    return (
        <div className="@container space-y-3">
            <div>
                <Table className="w-full text-sm" containerClassName="overflow-visible">
                    <TableHeader>
                        <TableRow className="text-left text-xs text-muted-foreground">
                            <TableHead className="py-2 pr-3 font-medium">{t('dashboard.streaks.student')}</TableHead>
                            {showSchool && <TableHead className="py-2 pr-3 font-medium">{t('common.school')}</TableHead>}
                            <TableHead className="py-2 pr-3 font-medium">{t('common.class')}</TableHead>
                            <TableHead className="py-2 pr-3 font-medium @max-2xl:hidden">{t('dashboard.streaks.mahalla')}</TableHead>
                            <TableHead className="py-2 text-right font-medium">{t('dashboard.streaks.days')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {query.data.data.map((row) => (
                            <TableRow key={`${row.school.id}-${row.personId}`} className="border-t">
                                <TableCell className="py-2 pr-3 font-medium whitespace-normal">
                                    {row.lastName} {row.firstName}
                                    <span className="block text-xs font-normal text-muted-foreground @2xl:hidden">{row.mahalla ?? ''}</span>
                                </TableCell>
                                {showSchool && (
                                    <TableCell className="py-2 pr-3 whitespace-normal">
                                        {row.school.name}
                                        <span className="block text-xs text-muted-foreground">{row.school.district}</span>
                                    </TableCell>
                                )}
                                <TableCell className="py-2 pr-3">{row.className}</TableCell>
                                <TableCell className="py-2 pr-3 text-muted-foreground @max-2xl:hidden">{row.mahalla ?? '—'}</TableCell>
                                <TableCell className="whitespace-nowrap py-2 text-right">
                                    <StatusBadge tone={row.days >= 10 ? 'danger' : 'warning'}>{t('dashboard.streaks.daysN', { count: row.days })}</StatusBadge>
                                    <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                        {t('dashboard.streaks.since', { date: formatDate(row.sinceDate) })}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {viewAllTo && query.data.totalPages > 1 && (
                <div className="flex justify-end">
                    <Button asChild variant="link" size="auto" className="text-sm">
                        <Link to={viewAllTo}>
                            {t('dashboard.streaks.viewAll', { count: query.data.total })}
                            <ArrowRight aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            )}
            {!viewAllTo && query.data.totalPages > 1 && (
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
