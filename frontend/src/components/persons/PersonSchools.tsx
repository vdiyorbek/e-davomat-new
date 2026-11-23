import { useState } from 'react';
import { ArrowRightLeft, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Pagination } from '@/components/common/Pagination';
import { ErrorState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoveMemberForm } from '@/components/memberships/MoveMemberForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/date';
import type { SchoolMembership, SchoolMembershipsPage } from '@/types/school-membership';

type Status = 'ACTIVE' | 'ENDED';

function MembershipList({
    personId,
    status,
    allowClassChange,
    onChanged,
}: {
    personId: number;
    status: Status;
    allowClassChange: boolean;
    onChanged: (message: string) => void;
}) {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [moving, setMoving] = useState<SchoolMembership | null>(null);
    const { session } = useAuth();
    const role = session?.profile.role;

    const canChangeClass =
        allowClassChange &&
        (role === 'SUPER_ADMIN' || role === 'REGION_ADMIN' || role === 'DISTRICT_ADMIN' || role === 'SCHOOL_ADMIN');
    const canTransferSchool =
        allowClassChange && (role === 'SUPER_ADMIN' || role === 'REGION_ADMIN' || role === 'DISTRICT_ADMIN');

    const query = useApiQuery<SchoolMembershipsPage>(
        `/school-memberships?personId=${personId}&status=${status}&page=${page}&limit=20`,
    );

    if (query.loading) {
        return (
            <div role="status" className="space-y-2">
                <span className="sr-only">{t('common.loading')}</span>
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>
        );
    }
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;

    if (query.data.total === 0) {
        return (
            <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                {status === 'ACTIVE' ? t('persons.schools.noActive') : t('persons.schools.noHistory')}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {query.data.data.map((membership) => {
                const isStudent = membership.type === 'STUDENT';
                const schoolClass = membership.schoolClass;
                const labelKey = `persons.schools.${status === 'ACTIVE' ? 'current' : 'past'}${isStudent ? 'Study' : 'Work'}`;
                const showActions =
                    allowClassChange &&
                    status === 'ACTIVE' &&
                    isStudent &&
                    membership.endDate === null &&
                    (canChangeClass || canTransferSchool);

                return (
                    <article key={membership.id} className="rounded-xl border bg-muted/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
                            <StatusBadge tone={status === 'ACTIVE' ? 'success' : 'neutral'}>
                                {t(`common.membershipStatus.${status}`)}
                            </StatusBadge>
                        </div>

                        <p className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]">
                            {membership.school.name}
                            {isStudent && schoolClass && `, ${t('persons.schools.className', { name: schoolClass.name })}`}
                        </p>
                        {isStudent && !schoolClass && (
                            <p className="mt-1 text-xs text-muted-foreground">{t('persons.schools.noClass')}</p>
                        )}

                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin aria-hidden="true" className="size-3.5" />
                            {membership.school.district.region.name} / {membership.school.district.name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {schoolClass && (
                                <span>{t('persons.schools.academicYear', { year: schoolClass.academicYear })}</span>
                            )}
                            <span className="tabular-nums">
                                {status === 'ENDED' && membership.endDate
                                    ? t('persons.schools.period', {
                                        from: formatDate(membership.startDate),
                                        to: formatDate(membership.endDate),
                                    })
                                    : t('persons.schools.ongoing', { from: formatDate(membership.startDate) })}
                            </span>
                        </div>

                        {showActions && (
                            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                                <Button type="button" size="sm" variant="outline" onClick={() => setMoving(membership)}>
                                    <ArrowRightLeft aria-hidden="true" />
                                    {t('members.actions.move')}
                                </Button>
                            </div>
                        )}
                    </article>
                );
            })}

            {query.data.totalPages > 1 && (
                <Pagination page={page} totalPages={query.data.totalPages} onPageChange={setPage} />
            )}

            <Dialog open={moving !== null} onOpenChange={(open) => !open && setMoving(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('members.move.title')}</DialogTitle>
                        <DialogDescription>{t('members.move.description')}</DialogDescription>
                    </DialogHeader>
                    {moving && (
                        <MoveMemberForm
                            key={moving.id}
                            membership={moving}
                            canTransferSchool={canTransferSchool}
                            onCancel={() => setMoving(null)}
                            onSaved={(mode) => {
                                setMoving(null);
                                onChanged(t(mode === 'school' ? 'members.transfer.success' : 'members.changeClass.success'));
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function PersonSchools({ personId, allowClassChange = false }: { personId: number; allowClassChange?: boolean }) {
    const { t } = useTranslation();
    const [revision, setRevision] = useState(0);
    const [success, setSuccess] = useState('');

    function handleChanged(message: string) {
        setSuccess(message);
        setRevision((value) => value + 1);
    }

    return (
        <div className="space-y-6">
            {success && <SuccessNotice>{success}</SuccessNotice>}

            <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t('persons.schools.currentTitle')}</h3>
                <MembershipList
                    key={`active-${personId}-${revision}`}
                    personId={personId}
                    status="ACTIVE"
                    allowClassChange={allowClassChange}
                    onChanged={handleChanged}
                />
            </section>

            <section className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">{t('persons.schools.historyTitle')}</h3>
                <MembershipList
                    key={`ended-${personId}-${revision}`}
                    personId={personId}
                    status="ENDED"
                    allowClassChange={false}
                    onChanged={handleChanged}
                />
            </section>
        </div>
    );
}
