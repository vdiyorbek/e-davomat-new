import { LogIn, LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/lib/date';
import { personFullName } from '@/lib/person';
import { cn } from '@/lib/utils';
import type { DailyAttendance } from '@/types/daily-attendance';

import { AttendanceDetailsDialog } from './AttendanceDetailsDialog';
import { AttendanceExcuseDialog } from './AttendanceExcuseDialog';
import { ATTENDANCE_STRIPE, ATTENDANCE_TONE } from './status';

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

    function canCreateExcuse(item: DailyAttendance) {
        return (
            students &&
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

    function NameCell({ item }: { item: DailyAttendance }) {
        const name = personFullName(item.person, t('attendance.noPerson'));
        return item.person ? (
            <Link
                to={`/persons/${item.person.id}`}
                className="font-semibold underline-offset-4 hover:text-primary hover:underline"
            >
                {name}
            </Link>
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
                                        <p className="leading-6 [overflow-wrap:anywhere]">
                                            <NameCell item={item} />
                                        </p>
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
                                        <span className="font-semibold tabular-nums">{formatTime(item.firstInTime)}</span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <LogOut aria-hidden="true" className="size-4 text-warning" />
                                        <span className="sr-only">{t('attendance.out')}:</span>
                                        <span className="font-semibold tabular-nums">{formatTime(item.lastOutTime)}</span>
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
                <Table className={students ? 'min-w-[900px]' : 'min-w-[760px]'}>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                            <TableHead>{t('common.fullName')}</TableHead>
                            <TableHead>{t('common.school')}</TableHead>
                            {students && <TableHead className="w-20">{t('common.class')}</TableHead>}
                            <TableHead className="w-20">{t('attendance.in')}</TableHead>
                            <TableHead className="w-20">{t('attendance.out')}</TableHead>
                            <TableHead className="w-36">{t('common.status')}</TableHead>
                            <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => {
                            const reason = reasonOf(item);
                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="pl-5 text-muted-foreground tabular-nums">{startIndex + index}</TableCell>
                                    <TableCell className="max-w-64 whitespace-normal">
                                        <NameCell item={item} />
                                    </TableCell>
                                    <TableCell className="max-w-64 whitespace-normal">
                                        <span className="font-medium">{item.school.name}</span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.district.name}</span>
                                    </TableCell>
                                    {students && <TableCell>{item.className ?? '—'}</TableCell>}
                                    <TableCell className="font-semibold tabular-nums">{formatTime(item.firstInTime)}</TableCell>
                                    <TableCell className="font-semibold tabular-nums">{formatTime(item.lastOutTime)}</TableCell>
                                    <TableCell>
                                        <StatusBadge tone={ATTENDANCE_TONE[item.attendanceStatus]}>
                                            {t(`attendance.status.${item.attendanceStatus}`)}
                                        </StatusBadge>
                                        {reason && <span className="mt-1 block text-xs text-muted-foreground">{reason}</span>}
                                    </TableCell>
                                    <TableCell className="pr-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <AttendanceDetailsDialog item={item} mode={mode} iconOnly />
                                            {canCreateExcuse(item) && <AttendanceExcuseDialog item={item} onSaved={onExcuseSaved} />}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        </>
    );
}
