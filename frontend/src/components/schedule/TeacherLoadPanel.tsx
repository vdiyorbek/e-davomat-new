import { useState } from 'react';
import { ChevronDown, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch } from '@/lib/auth-session';
import { weekdayName } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { TeacherLoad } from '@/types/cabinet';

type Assignment = TeacherLoad['teachers'][number]['assignments'][number];

function WeeklyHoursInput({ assignment, onSaved }: { assignment: Assignment; onSaved: () => void }) {
    const { t } = useTranslation();
    const [value, setValue] = useState(assignment.weeklyHours === null ? '' : String(assignment.weeklyHours));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const unchanged = value === (assignment.weeklyHours === null ? '' : String(assignment.weeklyHours));

    async function save() {
        if (busy || unchanged) return;
        const hours = value === '' ? null : Number(value);
        if (hours !== null && (!Number.isInteger(hours) || hours < 0 || hours > 40)) {
            setError(t('workload.hoursInvalid'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/teacher-assignments/${assignment.id}/weekly-hours`, { weeklyHours: hours });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('workload.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Input
                type="number"
                min={0}
                max={40}
                inputMode="numeric"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void save()}
                aria-label={t('workload.plannedFor', { name: `${assignment.className} ${assignment.subjectName}` })}
                aria-invalid={Boolean(error)}
                className="h-9 w-20"
                disabled={busy}
            />
            {!unchanged && (
                <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
                    {busy ? t('common.saving') : t('common.save')}
                </Button>
            )}
            {error && (
                <span role="alert" className="text-xs text-destructive">
                    {error}
                </span>
            )}
        </div>
    );
}

/** O‘qituvchilar haftalik yuklamasi: o‘quv rejasi (soat) va jadvalga qo‘yilgan darslar. */
export function TeacherLoadPanel({ schoolId, academicYear }: { schoolId: number; academicYear: string }) {
    const { t } = useTranslation();
    const query = useApiQuery<TeacherLoad>(`/lesson-schedules/teacher-load?schoolId=${schoolId}&academicYear=${academicYear}`);
    const [open, setOpen] = useState<number | null>(null);

    if (query.loading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;
    if (query.data.teachers.length === 0) {
        return <EmptyState icon={UsersRound} title={t('workload.emptyTitle')} description={t('workload.empty')} />;
    }

    const maxDay = Math.max(1, ...query.data.teachers.flatMap((teacher) => teacher.byDay));

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('workload.hint')}</p>
            <ul className="list-none space-y-2">
                {query.data.teachers.map((teacher) => {
                    const diff = teacher.scheduledHours - teacher.plannedHours;
                    const expanded = open === teacher.teacherMembershipId;
                    return (
                        <li key={teacher.teacherMembershipId} className="rounded-2xl border bg-card shadow-sm">
                            <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setOpen(expanded ? null : teacher.teacherMembershipId)}
                                className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold">
                                        {teacher.lastName} {teacher.firstName}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {t('workload.summary', { scheduled: teacher.scheduledHours, planned: teacher.plannedHours })}
                                    </span>
                                </span>
                                <span className="flex items-end gap-1" aria-label={t('workload.byDay')}>
                                    {teacher.byDay.map((count, index) => (
                                        <span key={index} className="flex flex-col items-center gap-0.5" title={`${weekdayName(index)}: ${count}`}>
                                            <span className="flex h-8 w-4 items-end overflow-hidden rounded bg-muted">
                                                <span className="w-full rounded bg-primary" style={{ height: `${(count / maxDay) * 100}%` }} />
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">{weekdayName(index, 'short')}</span>
                                        </span>
                                    ))}
                                </span>
                                {teacher.plannedHours > 0 && (
                                    <StatusBadge tone={diff === 0 ? 'success' : diff < 0 ? 'warning' : 'danger'}>
                                        {diff === 0 ? t('workload.complete') : diff < 0 ? t('workload.missing', { count: -diff }) : t('workload.extra', { count: diff })}
                                    </StatusBadge>
                                )}
                                <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                            </button>
                            {expanded && (
                                <div className="divide-y border-t">
                                    {teacher.assignments.map((assignment) => (
                                        <div key={assignment.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                                            <span className="min-w-40 flex-1 font-medium">
                                                {assignment.className} · {assignment.subjectName}
                                            </span>
                                            <span className="text-muted-foreground">{t('workload.scheduledN', { count: assignment.scheduled })}</span>
                                            <WeeklyHoursInput key={`${assignment.id}-${assignment.weeklyHours}`} assignment={assignment} onSaved={query.retry} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
