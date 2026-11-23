import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, ExternalLink, IdCard, LogIn, LogOut, Phone, School } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PdfPreview } from '@/components/attendance/AttendanceExcuseActions';
import { TimePhoto } from '@/components/attendance/TimePhoto';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { addDays, formatDate, formatDateLong, weekdayIndex, weekdayName } from '@/lib/date';
import { personFullName } from '@/lib/person';
import { cn } from '@/lib/utils';
import type { PersonAttendanceDay, PersonAttendanceHistory, PersonDayStatus } from '@/types/person-attendance';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Mode = 'students' | 'teachers';
type Range = 'last7' | 'last14' | 'month' | 'last30';

const RANGES: Range[] = ['last7', 'last14', 'month', 'last30'];

const DAY_TONE: Record<PersonDayStatus, StatusTone> = {
    inside: 'success',
    left: 'warning',
    excused: 'primary',
    absent: 'danger',
    anomaly: 'neutral',
    day_off: 'neutral',
    unconfigured: 'warning',
    conflict: 'danger',
    no_data: 'neutral',
    no_record: 'neutral',
};

/** Holat yorlig‘i: `no_record` uchun mavjud «Qayd yo‘q» kaliti. */
function statusKey(status: PersonDayStatus): string {
    return status === 'no_record' ? 'none' : status;
}

function rangeDates(range: Range, end: string): { from: string; to: string } {
    switch (range) {
        case 'last7':
            return { from: addDays(end, -6), to: end };
        case 'last14':
            return { from: addDays(end, -13), to: end };
        case 'month':
            return { from: `${end.slice(0, 8)}01`, to: end };
        case 'last30':
            return { from: addDays(end, -29), to: end };
    }
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b border-dashed py-2.5 text-sm last:border-b-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
        </div>
    );
}

function HistoryBody({
    path,
    mode,
    range,
    onRangeChange,
}: {
    path: string;
    mode: Mode;
    range: Range;
    onRangeChange: (range: Range) => void;
}) {
    const { t } = useTranslation();
    const { session } = useAuth();
    const { data, loading, error, retry } = useApiQuery<PersonAttendanceHistory>(path);

    // PDF hujjatni faqat arizalar bilan ishlaydiganlar ochadi.
    const role = session?.profile.role;
    const canOpenPdf = role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';

    if (loading) return <LoadingState rows={6} />;
    if (error || !data) return <ErrorState message={error || t('attendance.person.loadFailed')} onRetry={retry} />;

    const { person, membership, stats } = data;
    const fullName = personFullName(person);
    const shortName = [person.lastName, person.firstName].filter(Boolean).join(' ');
    const students = mode === 'students';

    const statChips: { key: string; value: number; tone: StatusTone }[] = [
        { key: 'present', value: stats.inside + stats.left + stats.anomaly, tone: 'success' },
        { key: 'absent', value: stats.absent, tone: 'danger' },
        { key: 'excused', value: stats.excused, tone: 'primary' },
        { key: 'dayOff', value: stats.day_off, tone: 'neutral' },
    ];

    function reasonText(day: PersonAttendanceDay) {
        if (!day.excuse) return '—';
        const reason = t(`excuses.reason.${day.excuse.reason}`);
        return day.excuse.reasonNote ? `${reason}: ${day.excuse.reasonNote}` : reason;
    }

    function documentCell(day: PersonAttendanceDay) {
        if (!day.excuse) return <span className="text-muted-foreground">—</span>;
        return canOpenPdf ? <PdfPreview excuseId={day.excuse.id} /> : <span>№{day.excuse.id}</span>;
    }

    return (
        <div className="min-w-0 space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                {/* Rasm va qisqa ma’lumot */}
                <section className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/20 p-5 text-center">
                    <div className="rounded-full bg-brand-gradient p-1 shadow-lg">
                        <PersonPhoto
                            personId={person.id}
                            photoUrl={person.photoUrl}
                            name={fullName}
                            enlargeOnClick
                            className="size-32 rounded-full border-4 border-card object-cover"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="font-heading text-base font-bold [overflow-wrap:anywhere]">{shortName}</p>
                        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                            {students && membership.schoolClass && (
                                <StatusBadge tone="info" dot={false}>
                                    {membership.schoolClass.name}
                                </StatusBadge>
                            )}
                            {!students && membership.position && (
                                <StatusBadge tone="info" dot={false}>
                                    {membership.position}
                                </StatusBadge>
                            )}
                            {!membership.active && (
                                <StatusBadge tone="neutral">{t('attendance.person.inactive')}</StatusBadge>
                            )}
                        </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-auto">
                        <Link to={`/persons/${person.id}`}>
                            <ExternalLink aria-hidden="true" />
                            {t('attendance.person.openProfile')}
                        </Link>
                    </Button>
                </section>

                {/* Shaxsiy ma’lumotlar */}
                <section className="rounded-2xl border p-4 sm:p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold">
                        <IdCard aria-hidden="true" className="size-4 text-primary" />
                        {t('attendance.person.personal')}
                    </h3>
                    <dl>
                        <InfoRow label={t('common.pnfl')}>
                            <span className="tabular-nums">{person.pnfl}</span>
                        </InfoRow>
                        <InfoRow label={t('persons.birthDate')}>
                            {person.birthDate ? formatDateLong(person.birthDate) : '—'}
                        </InfoRow>
                        <InfoRow label={t('persons.gender')}>
                            {person.gender ? t(`persons.genders.${person.gender}`) : '—'}
                        </InfoRow>
                        <InfoRow label={t('persons.nationality')}>{person.nationality || '—'}</InfoRow>
                        <InfoRow label={t('persons.phone')}>
                            {person.phoneNumber ? (
                                <a
                                    href={`tel:${person.phoneNumber}`}
                                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                >
                                    <Phone aria-hidden="true" className="size-3.5" />
                                    <span className="tabular-nums">{person.phoneNumber}</span>
                                </a>
                            ) : (
                                '—'
                            )}
                        </InfoRow>
                        {!students && (
                            <InfoRow label={t('memberDetails.fields.position')}>{membership.position || '—'}</InfoRow>
                        )}
                        <InfoRow label={t('common.region')}>{membership.region.name}</InfoRow>
                        <InfoRow label={t('common.district')}>{membership.district.name}</InfoRow>
                        <InfoRow label={t('common.school')}>{membership.school.name}</InfoRow>
                        {students && (
                            <InfoRow label={t('common.class')}>{membership.schoolClass?.name ?? '—'}</InfoRow>
                        )}
                        {person.address && <InfoRow label={t('persons.address')}>{person.address}</InfoRow>}
                    </dl>
                </section>
            </div>

            {/* Davomat kunlari */}
            <section className="space-y-3 rounded-2xl border p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
                        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
                        {t('attendance.person.days')}
                        <span className="font-normal text-muted-foreground tabular-nums">
                            ({formatDate(data.from)} — {formatDate(data.to)})
                        </span>
                    </h3>
                    <SelectField
                        value={range}
                        onValueChange={(value) => onRangeChange(value as Range)}
                        options={RANGES.map((value) => ({ value, label: t(`attendance.person.ranges.${value}`) }))}
                        aria-label={t('attendance.person.range')}
                        className="h-9 sm:w-44"
                    />
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {statChips.map((chip) => (
                        <StatusBadge key={chip.key} tone={chip.tone}>
                            {t(`attendance.person.stats.${chip.key}`, { count: chip.value })}
                        </StatusBadge>
                    ))}
                </div>

                {/* Telefon: ixcham ro‘yxat */}
                <ul className="divide-y rounded-xl border md:hidden">
                    {data.days.map((day) => (
                        <li key={day.date} className="space-y-1.5 px-3 py-2.5 text-sm">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold tabular-nums">
                                    {formatDate(day.date)}{' '}
                                    <span className="font-normal text-muted-foreground">
                                        {weekdayName(weekdayIndex(day.date), 'short')}
                                    </span>
                                </span>
                                <StatusBadge tone={DAY_TONE[day.status]}>
                                    {t(`attendance.status.${statusKey(day.status)}`)}
                                </StatusBadge>
                            </div>
                            {(day.firstInTime || day.lastOutTime) && (
                                <p className="flex gap-4 text-xs tabular-nums">
                                    <span className="flex items-center gap-1">
                                        <LogIn aria-hidden="true" className="size-3.5 text-success" />
                                        <TimePhoto time={day.firstInTime} url={day.firstInUrl} label={t('attendance.in')} name={fullName} date={day.date} />
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <LogOut aria-hidden="true" className="size-3.5 text-warning" />
                                        <TimePhoto time={day.lastOutTime} url={day.lastOutUrl} label={t('attendance.out')} name={fullName} date={day.date} />
                                    </span>
                                </p>
                            )}
                            {day.excuse && (
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{reasonText(day)}</span>
                                    {documentCell(day)}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Planshet va kompyuter: jadval */}
                <div className="hidden max-h-[22rem] overflow-auto rounded-xl border md:block">
                    <Table className="w-full min-w-[640px] text-sm">
                        <TableHeader className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                            <TableRow>
                                <TableHead className="w-10 px-3 py-2 font-semibold">{t('common.number')}</TableHead>
                                <TableHead className="px-3 py-2 font-semibold">{t('attendance.person.date')}</TableHead>
                                <TableHead className="px-3 py-2 font-semibold">{t('attendance.in')}</TableHead>
                                <TableHead className="px-3 py-2 font-semibold">{t('attendance.out')}</TableHead>
                                <TableHead className="px-3 py-2 font-semibold">{t('common.status')}</TableHead>
                                <TableHead className="px-3 py-2 font-semibold">{t('attendance.person.reason')}</TableHead>
                                <TableHead className="px-3 py-2 text-right font-semibold">{t('attendance.person.document')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y">
                            {data.days.map((day, index) => (
                                <TableRow key={day.date} className={cn(day.status === 'absent' && 'bg-destructive/5')}>
                                    <TableCell className="px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                                    <TableCell className="px-3 py-2 whitespace-nowrap tabular-nums">
                                        {formatDate(day.date)}{' '}
                                        <span className="text-xs text-muted-foreground">
                                            {weekdayName(weekdayIndex(day.date), 'short')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-3 py-2 font-semibold tabular-nums">
                                        <TimePhoto time={day.firstInTime} url={day.firstInUrl} label={t('attendance.in')} name={fullName} date={day.date} />
                                    </TableCell>
                                    <TableCell className="px-3 py-2 font-semibold tabular-nums">
                                        <TimePhoto time={day.lastOutTime} url={day.lastOutUrl} label={t('attendance.out')} name={fullName} date={day.date} />
                                    </TableCell>
                                    <TableCell className="px-3 py-2">
                                        <StatusBadge tone={DAY_TONE[day.status]}>
                                            {t(`attendance.status.${statusKey(day.status)}`)}
                                        </StatusBadge>
                                    </TableCell>
                                    <TableCell className="max-w-56 px-3 py-2 text-xs [overflow-wrap:anywhere]">{reasonText(day)}</TableCell>
                                    <TableCell className="px-3 py-2 text-right">{documentCell(day)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <School aria-hidden="true" className="size-3.5" />
                    {t('attendance.person.daysHint')}
                </p>
            </section>
        </div>
    );
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pnfl: string;
    /** Ro‘yxatdagi qatordan olingan ism — yuklanguncha sarlavhada turadi. */
    name: string;
    schoolName: string;
    mode: Mode;
    /** Davrning oxirgi kuni (odatda ro‘yxatda tanlangan sana). */
    endDate: string;
}

/** O‘quvchi yoki o‘qituvchining batafsil davomat oynasi. */
export function PersonAttendanceDialog({ open, onOpenChange, pnfl, name, schoolName, mode, endDate }: Props) {
    const { t } = useTranslation();
    const [range, setRange] = useState<Range>('last7');

    const dates = rangeDates(range, endDate);
    const params = new URLSearchParams({
        pnfl,
        membershipType: mode === 'students' ? 'STUDENT' : 'TEACHER',
        from: dates.from,
        to: dates.to,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader className="pr-8">
                    <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        {t(`attendance.person.kind.${mode}`)}
                    </p>
                    <DialogTitle className="[overflow-wrap:anywhere]">{name}</DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-x-2 tabular-nums">
                        <span>{pnfl}</span>
                        <span aria-hidden="true">·</span>
                        <span>{schoolName}</span>
                    </DialogDescription>
                </DialogHeader>

                {open && (
                    <HistoryBody
                        key={params.toString()}
                        path={`/daily-attendance/person-history?${params.toString()}`}
                        mode={mode}
                        range={range}
                        onRangeChange={setRange}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
