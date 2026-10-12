import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { SchoolMembershipsPage } from '@/types/school-membership';
import { ChangeClassForm } from '@/components/memberships/ChangeClassForm';
import { useAuth } from '@/hooks/useAuth';
import { TransferSchoolForm } from '@/components/memberships/TransferSchoolForm';

function formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
}

function MembershipList({
    personId,
    status,
    allowClassChange,
    onChanged,
}: {
    personId: number;
    status: 'ACTIVE' | 'ENDED';
    allowClassChange: boolean;
    onChanged: () => void;
}) {
    const [page, setPage] = useState(1);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [transferringId, setTransferringId] =
        useState<number | null>(null);
    const { session } = useAuth()
    const role = session?.profile.role;


    const canChangeClass =
        allowClassChange &&
        (
            role === 'SUPER_ADMIN' ||
            role === 'REGION_ADMIN' ||
            role === 'DISTRICT_ADMIN' ||
            role === 'SCHOOL_ADMIN'
        );
    const canTransferSchool =
        allowClassChange &&
        (
            role === 'SUPER_ADMIN' ||
            role === 'REGION_ADMIN' ||
            role === 'DISTRICT_ADMIN'
        );

    const query = useApiQuery<SchoolMembershipsPage>(
        `/school-memberships?personId=${personId}&status=${status}&page=${page}&limit=20`,
    );

    if (query.loading) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                Yuklanmoqda…
            </p>
        );
    }

    if (query.error) {
        return (
            <div className="space-y-2">
                <p role="alert" className="text-sm text-destructive">
                    {query.error}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={query.retry}
                >
                    Qayta urinish
                </Button>
            </div>
        );
    }

    if (!query.data) return null;

    if (query.data.total === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {status === 'ACTIVE'
                    ? 'Hozir faol maktab biriktirishi yo‘q.'
                    : 'Tugagan biriktirishlar tarixi yo‘q.'}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {query.data.data.map((membership) => {
                const isStudent = membership.type === 'STUDENT';
                const schoolClass = membership.schoolClass;

                const label = status === 'ACTIVE'
                    ? isStudent
                        ? 'O‘qiyotgan maktabi'
                        : 'Ishlayotgan maktabi'
                    : isStudent
                        ? 'O‘qigan maktabi'
                        : 'Ishlagan maktabi';

                return (
                    <div
                        key={membership.id}
                        className="rounded-lg border bg-muted/30 p-4"
                    >
                        <p className="text-xs text-muted-foreground">
                            {label}
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                            {membership.school.name}
                            {isStudent && schoolClass
                                ? `, ${schoolClass.name}-sinf`
                                : ''}
                        </p>

                        {isStudent && !schoolClass && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Sinf kiritilmagan
                            </p>
                        )}

                        <p className="mt-1 text-xs text-muted-foreground">
                            {membership.school.district.region.name}
                            {' / '}
                            {membership.school.district.name}
                        </p>

                        {schoolClass && (
                            <p className="mt-2 text-sm">
                                O‘quv yili: {schoolClass.academicYear}
                            </p>
                        )}

                        <p className="mt-1 text-sm">
                            {formatDate(membership.startDate)}
                            {' dan'}
                            {status === 'ENDED' && membership.endDate
                                ? ` ${formatDate(membership.endDate)} gacha`
                                : ' — davom etmoqda'}
                        </p>
                        {allowClassChange &&
                            status === 'ACTIVE' &&
                            isStudent &&
                            membership.endDate === null &&
                            (canChangeClass || canTransferSchool) && (
                                <div className="mt-4 border-t pt-4">
                                    {editingId === membership.id ? (
                                        <ChangeClassForm
                                            key={`class-${membership.id}`}
                                            membership={membership}
                                            onCancel={() => setEditingId(null)}
                                            onSaved={onChanged}
                                        />
                                    ) : transferringId === membership.id ? (
                                        <TransferSchoolForm
                                            key={`school-${membership.id}`}
                                            membership={membership}
                                            onCancel={() => setTransferringId(null)}
                                            onSaved={onChanged}
                                        />
                                    ) : (
                                        <div className="flex flex-wrap gap-3">
                                            {canChangeClass && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setTransferringId(null);
                                                        setEditingId(membership.id);
                                                    }}
                                                >
                                                    Sinfni almashtirish
                                                </Button>
                                            )}

                                            {canTransferSchool && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setTransferringId(membership.id);
                                                    }}
                                                >
                                                    Boshqa maktabga ko‘chirish
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                    </div>
                );
            })}

            {query.data.totalPages > 1 && (
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((value) => value - 1)}
                    >
                        Oldingi
                    </Button>

                    <span className="text-sm">
                        {page} / {query.data.totalPages}
                    </span>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={page >= query.data.totalPages}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        Keyingi
                    </Button>
                </div>
            )}
        </div>
    );
}

export function PersonSchools({
    personId,
    allowClassChange = false,
}: {
    personId: number;
    allowClassChange?: boolean;
}) {
    const [revision, setRevision] = useState(0);
    const [success, setSuccess] = useState('');

    function handleChanged() {
        setSuccess('Ko‘chirish saqlandi.');
        setRevision((value) => value + 1);
    }

    return (
        <div className="space-y-6">
            {success && (
                <p role="status" className="text-sm text-green-700 dark:text-green-400">
                    {success}
                </p>
            )}

            <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                    Hozirgi maktabi
                </h3>

                <MembershipList
                    key={`active-${personId}-${revision}`}
                    personId={personId}
                    status="ACTIVE"
                    allowClassChange={allowClassChange}
                    onChanged={handleChanged}
                />
            </section>

            <section className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">
                    O‘qish va ish tarixi
                </h3>

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