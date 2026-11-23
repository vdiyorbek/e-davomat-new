import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { personFullName } from '@/lib/person';
import { cn } from '@/lib/utils';
import type { DailyAttendance } from '@/types/daily-attendance';

import { AttendanceDetailsDialog } from './AttendanceDetailsDialog';
import { AttendanceExcuseDialog } from './AttendanceExcuseDialog';
import { PersonAttendanceDialog } from './PersonAttendanceDialog';
import { TimePhoto } from './TimePhoto';
import { ATTENDANCE_STRIPE, ATTENDANCE_TONE } from './status';
import { Button } from '@/components/ui/button';

interface Props {
    items: DailyAttendance[];
    startIndex: number;
    onExcuseSaved: () => void;
    mode?: 'students' | 'teachers';
}

export function AttendanceTable({ items, startIndex, onExcuseSaved, mode = 'students' }: Props) {
    const { t } = useTranslation();
    const { session } = useAuth();
    const profile = session?.profile;
    const students = mode === 'students';
    const [selected, setSelected] = useState<DailyAttendance | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    function canCreateExcuse(item: DailyAttendance) {
        return (
            Boolean(item.person) &&
            item.attendanceStatus === 'absent' &&
            !item.firstInTime &&
            !item.lastOutTime &&
            (profile?.role === 'SUPER_ADMIN' || (profile?.role === 'SCHOOL_ADMIN' && profile.schoolId === item.schoolId))
        );
    }

    function reasonOf(item: DailyAttendance) {
        return item.attendanceStatus === 'excused' && item.excuseReason ? t(`excuses.reason.${item.excuseReason}`) : null;
    }

    const nameOf = (item: DailyAttendance) => personFullName(item.person, t('attendance.noPerson'));

    function openPerson(item: DailyAttendance) {
        setSelected(item);
        setDialogOpen(true);
    }

    /** F.I.Sh. — bosilganda batafsil davomat oynasi ochiladi. */
    function renderName(item: DailyAttendance) {
        const name = personFullName(item.person, t('attendance.noPerson'));
        return item.person ? (
            <Button variant="link" size="auto"
                type="button"
                onClick={() => openPerson(item)}
                className="text-left font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
                {name}
            </Button>
        ) : (
            <span className="text-muted-foreground">{name}</span>
        );
    }

    return (
        <>
            {/* Telefon va planshet: ixcham kartalar */}
            <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                {items.map((item) => {
                    const reason = reasonOf(item);
                    return (
                        <li key={item.id}>
                            <Card size="sm" className="relative gap-3 overflow-hidden pr-4 pl-5">
                                <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', ATTENDANCE_STRIPE[item.attendanceStatus])} />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="leading-6 [overflow-wrap:anywhere]">{renderName(item)}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                            {item.school.name}
                                            {students && item.className && ` · ${item.className}`}
                                        </p>
                                    </div>
                                    <StatusBadge tone={ATTENDANCE_TONE[item.attendanceStatus]}>
                                        {t(`attendance.status.${item.attendanceStatus}`)}
                                    </StatusBadge>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="flex items-center gap-1.5">
                                        <LogIn aria-hidden="true" className="size-4 text-success" />
                                        <span className="sr-only">{t('attendance.in')}:</span>
                                        <span className="font-semibold tabular-nums">
                                            <TimePhoto time={item.firstInTime} url={item.firstInUrl} status={item.firstInPhotoStatus} label={t('attendance.in')} name={nameOf(item)} date={item.date} />
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <LogOut aria-hidden="true" className="size-4 text-warning" />
                                        <span className="sr-only">{t('attendance.out')}:</span>
                                        <span className="font-semibold tabular-nums">
                                            <TimePhoto time={item.lastOutTime} url={item.lastOutUrl} status={item.lastOutPhotoStatus} label={t('attendance.out')} name={nameOf(item)} date={item.date} />
                                        </span>
                                    </span>
                                    {reason && <span className="truncate text-xs text-muted-foreground">{reason}</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <AttendanceDetailsDialog item={item} mode={mode} />
                                    {canCreateExcuse(item) && <AttendanceExcuseDialog item={item} onSaved={onExcuseSaved} />}
                                </div>
                            </Card>
                        </li>
                    );
                })}
            </ul>

            {/* Kompyuter: jadval */}
            <Card className="hidden py-0 xl:flex">
                <Table className={students ? 'min-w-[980px]' : 'min-w-[860px]'}>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                            <TableHead>{t('common.fullName')}</TableHead>
                            <TableHead>{t('common.school')}</TableHead>
                            {students && <TableHead className="w-20">{t('common.class')}</TableHead>}
                            <TableHead className="w-20">{t('attendance.in')}</TableHead>
                            <TableHead className="w-20">{t('attendance.out')}</TableHead>
                            <TableHead className="w-40">{t('common.status')}</TableHead>
                            <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => {
                            const reason = reasonOf(item);
                            return (
                                <TableRow key={item.id} className={cn(item.attendanceStatus === 'absent' && 'bg-destructive/[0.03]')}>
                                    <TableCell className="pl-5 text-muted-foreground tabular-nums">{startIndex + index}</TableCell>
                                    <TableCell className="max-w-72 whitespace-normal">
                                        {renderName(item)}
                                        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">{item.pnfl}</span>
                                    </TableCell>
                                    <TableCell className="max-w-64 whitespace-normal">
                                        <span className="font-medium">{item.school.name}</span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.district.name}</span>
                                    </TableCell>
                                    {students && (
                                        <TableCell>
                                            {item.className ? (
                                                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                                                    {item.className}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell className="font-semibold tabular-nums">
                                        <TimePhoto time={item.firstInTime} url={item.firstInUrl} status={item.firstInPhotoStatus} label={t('attendance.in')} name={nameOf(item)} date={item.date} />
                                    </TableCell>
                                    <TableCell className="font-semibold tabular-nums">
                                        <TimePhoto time={item.lastOutTime} url={item.lastOutUrl} status={item.lastOutPhotoStatus} label={t('attendance.out')} name={nameOf(item)} date={item.date} />
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge tone={ATTENDANCE_TONE[item.attendanceStatus]}>
                                            {t(`attendance.status.${item.attendanceStatus}`)}
                                        </StatusBadge>
                                        {reason && <span className="mt-1 block text-xs text-muted-foreground">{reason}</span>}
                                    </TableCell>
                                    <TableCell className="pr-5">
                                        <div className="flex items-center justify-end gap-2">
                                            {canCreateExcuse(item) && <AttendanceExcuseDialog item={item} onSaved={onExcuseSaved} />}
                                            <AttendanceDetailsDialog item={item} mode={mode} iconOnly />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            {selected && (
                <PersonAttendanceDialog
                    key={selected.id}
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    pnfl={selected.pnfl}
                    name={personFullName(selected.person, t('attendance.noPerson'))}
                    schoolName={selected.school.name}
                    mode={mode}
                    endDate={selected.date}
                />
            )}
        </>
    );
}
