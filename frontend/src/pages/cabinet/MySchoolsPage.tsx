import { BookOpen, Building2, CalendarDays, GraduationCap, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import type { MySchool } from '@/types/school';

function SchoolCard({ item }: { item: MySchool }) {
    const { t } = useTranslation();
    const isStudent = item.type === 'STUDENT';
    const RoleIcon = isStudent ? GraduationCap : BookOpen;

    return (
        <Card className="h-full min-w-0 gap-5">
            <CardHeader className="gap-4 px-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Building2 aria-hidden="true" className="size-5" />
                    </span>
                    <StatusBadge tone={isStudent ? 'primary' : 'info'} dot={false}>
                        <RoleIcon aria-hidden="true" className="size-3.5" />
                        {t(`common.personType.${item.type}`)}
                    </StatusBadge>
                </div>
                <CardTitle className="text-base leading-7 font-semibold [overflow-wrap:anywhere] sm:text-lg">
                    {item.school.name}
                </CardTitle>
                <div className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p>{item.school.region.name}</p>
                        <p>{item.school.district.name}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="mt-auto space-y-3 px-5 sm:px-6">
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        {isStudent ? t('mySchools.studyPeriod') : t('mySchools.workPeriod')}
                    </div>
                    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <div className="min-w-0">
                            <dt className="text-xs leading-5 text-muted-foreground">{t('membership.startDate')}</dt>
                            <dd className="mt-1 text-sm font-medium tabular-nums">{formatDate(item.startDate)}</dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-xs leading-5 text-muted-foreground">{t('membership.endDate')}</dt>
                            <dd className="mt-1 text-sm font-medium tabular-nums">{formatDate(item.endDate)}</dd>
                        </div>
                    </dl>
                </div>
                {item.endDate && (
                    <p className="text-xs leading-5 text-muted-foreground">{t('membership.endDateHint')}</p>
                )}
            </CardContent>
        </Card>
    );
}

export function MySchoolsPage() {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<MySchool[]>('/me/schools');
    const items = data ?? [];

    return (
        <div className="min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.personal')}
                title={t('mySchools.title')}
                description={t('mySchools.subtitle')}
                actions={
                    !loading && !error ? (
                        <StatusBadge tone="neutral" dot={false}>
                            {t('mySchools.count', { count: items.length })}
                        </StatusBadge>
                    ) : undefined
                }
            />

            {loading ? (
                <div role="status" className="grid gap-4 md:grid-cols-2 xl:gap-6">
                    <span className="sr-only">{t('common.loading')}</span>
                    {[0, 1].map((index) => (
                        <Skeleton key={index} className="h-72 rounded-2xl" />
                    ))}
                </div>
            ) : error ? (
                <ErrorState message={error} onRetry={retry} />
            ) : items.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title={t('mySchools.emptyTitle')}
                    description={t('mySchools.emptyText')}
                />
            ) : (
                <ul
                    aria-label={t('mySchools.listLabel')}
                    className="grid min-w-0 list-none gap-4 md:grid-cols-2 xl:gap-6"
                >
                    {items.map((item) => (
                        <li key={item.membershipId} className="min-w-0">
                            <SchoolCard item={item} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
