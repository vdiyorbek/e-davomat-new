import { AlertTriangle, CalendarClock, ClipboardList, FileCheck2, UserCheck, UserX, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import type { InspectorSummary } from '@/types/inspector';

/** Uchastkavoy bosh sahifasi: bugungi davomat va o‘rganilishi kerak bo‘lgan ishlar. */
export function InspectorHomePage() {
    const { t } = useTranslation();
    const query = useApiQuery<InspectorSummary>('/inspectors/me/summary');
    const s = query.data;
    const loading = query.loading;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('inspectors.home.title')}
                description={s ? t('inspectors.home.description', { date: formatDate(s.date) }) : t('inspectors.home.descriptionShort')}
            />
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {s && s.mahallaCount === 0 && <ErrorState message={t('inspectors.students.noMahallas')} />}

            {s && s.newAbsentees > 0 && (
                <Card className="flex-row flex-wrap items-center justify-between gap-3 border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
                        <p className="text-sm font-medium">{t('inspectors.home.alert', { count: s.newAbsentees, days: s.minDays })}</p>
                    </div>
                    <Button asChild size="sm">
                        <Link to="/inspector/absentees">{t('inspectors.home.alertAction')}</Link>
                    </Button>
                </Card>
            )}
            {s && s.followUpsDue > 0 && (
                <SuccessNotice>{t('inspectors.home.followUps', { count: s.followUpsDue })}</SuccessNotice>
            )}

            <section aria-label={t('inspectors.home.todayTitle')} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{t('inspectors.home.todayTitle')}</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiCard label={t('inspectors.home.students')} value={s?.students ?? 0} icon={UsersRound} tone="primary" loading={loading} />
                    <KpiCard label={t('inspectors.status.PRESENT')} value={s?.today.PRESENT ?? 0} icon={UserCheck} tone="success" loading={loading} />
                    <KpiCard label={t('inspectors.status.ABSENT')} value={s?.today.ABSENT ?? 0} icon={UserX} tone="danger" loading={loading} />
                    <KpiCard label={t('inspectors.status.EXCUSED')} value={s?.today.EXCUSED ?? 0} icon={FileCheck2} tone="neutral" loading={loading} />
                </div>
            </section>

            <section aria-label={t('inspectors.home.casesTitle')} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{t('inspectors.home.casesTitle')}</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiCard
                        label={t('inspectors.home.absentees', { days: s?.minDays ?? 5 })}
                        value={s?.absentees ?? 0}
                        icon={AlertTriangle}
                        tone="danger"
                        loading={loading}
                    />
                    <KpiCard label={t('inspectors.home.newAbsentees')} value={s?.newAbsentees ?? 0} icon={ClipboardList} tone="warning" loading={loading} />
                    <KpiCard label={t('inspectors.home.openCases')} value={s?.openCases ?? 0} icon={CalendarClock} tone="primary" loading={loading} />
                    <KpiCard label={t('inspectors.home.closedThisMonth')} value={s?.closedThisMonth ?? 0} icon={FileCheck2} tone="success" loading={loading} />
                </div>
            </section>

            <div className="flex flex-wrap gap-2">
                <Button asChild>
                    <Link to="/inspector/absentees">{t('inspectors.home.goAbsentees')}</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link to="/inspector/cases">{t('inspectors.home.goCases')}</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link to="/inspector/students">{t('inspectors.home.goStudents')}</Link>
                </Button>
            </div>
        </div>
    );
}
