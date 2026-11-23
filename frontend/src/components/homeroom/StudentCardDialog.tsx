import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { DayCellMark } from '@/components/homeroom/DayCellMark';
import { GuardianLinks } from '@/components/homeroom/GuardianLinks';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomStudentCard } from '@/types/homeroom';

function Body({ classId, personId }: { classId: number; personId: number }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<HomeroomStudentCard>(`/homeroom/classes/${classId}/students/${personId}`);

    if (loading) return <LoadingState rows={3} />;
    if (error || !data) return <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />;

    const stats = [
        { key: 'present', value: data.last30.present },
        { key: 'absent', value: data.last30.absent },
        { key: 'excused', value: data.last30.excused },
    ] as const;

    return (
        <div className="space-y-5">
            <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t('persons.guardians.title')}</h3>
                <GuardianLinks
                    guardians={data.guardians.map((g) => ({
                        relation: g.relation,
                        name: [g.lastName, g.firstName, g.middleName].filter(Boolean).join(' '),
                        phoneNumber: g.phoneNumber,
                    }))}
                />
            </section>

            <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t('homeroom.card.last30')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {stats.map((item) => (
                        <div key={item.key} className="rounded-xl border bg-muted/40 px-3 py-2">
                            <p className="text-xs text-muted-foreground">{t(`homeroom.cells.${item.key}`)}</p>
                            <p className="text-lg font-bold tabular-nums">{item.value}</p>
                        </div>
                    ))}
                    <div className="rounded-xl border bg-muted/40 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{t('homeroom.card.rate')}</p>
                        <p className="text-lg font-bold tabular-nums">{data.last30.rate === null ? '—' : `${data.last30.rate}%`}</p>
                    </div>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                    {data.days.map((day) => (
                        <li key={day.date} title={formatDate(day.date)}>
                            <DayCellMark cell={day.cell} />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

export function StudentCardDialog({
    classId,
    student,
    onClose,
}: {
    classId: number;
    student: { personId: number; firstName: string; lastName: string; middleName: string | null } | null;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="[overflow-wrap:anywhere]">{student ? personFullName(student) : ''}</DialogTitle>
                    <DialogDescription>{t('homeroom.card.description')}</DialogDescription>
                </DialogHeader>
                {student && <Body key={student.personId} classId={classId} personId={student.personId} />}
            </DialogContent>
        </Dialog>
    );
}
