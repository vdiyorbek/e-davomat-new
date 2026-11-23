import { useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ATTENDANCE_TONE } from '@/components/attendance/status';
import { DatePicker } from '@/components/common/DatePicker';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StudentCardDialog } from '@/components/homeroom/StudentCardDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { addDays, formatTime, todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomAttendance } from '@/types/homeroom';

type Person = { personId: number; firstName: string; lastName: string; middleName: string | null };

/** Tanlangan kundagi sinf davomati: kelgan, kelmagan, ruxsatli. */
export function TodayTab({ classId }: { classId: number }) {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const [date, setDate] = useState(today);
    const [open, setOpen] = useState<Person | null>(null);
    const { data, loading, error, retry } = useApiQuery<HomeroomAttendance>(`/homeroom/classes/${classId}/attendance?date=${date}`);

    const counts = { present: 0, absent: 0, excused: 0 };
    for (const row of data?.data ?? []) {
        if (row.attendanceStatus === 'inside' || row.attendanceStatus === 'left') counts.present++;
        else if (row.attendanceStatus === 'excused') counts.excused++;
        else if (row.attendanceStatus === 'absent') counts.absent++;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label={t('attendance.prevDay')} onClick={() => setDate(addDays(date, -1))}>
                    <ChevronLeft aria-hidden="true" />
                </Button>
                <div className="w-44">
                    <DatePicker value={date} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label={t('common.date')} />
                </div>
                <Button type="button" variant="outline" size="icon" aria-label={t('attendance.nextDay')} disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
                    <ChevronRight aria-hidden="true" />
                </Button>
                {date !== today && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDate(today)}>
                        {t('common.today')}
                    </Button>
                )}
            </div>

            {data && (
                <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                    {(['present', 'absent', 'excused'] as const).map((key) => (
                        <div key={key} className="rounded-xl border bg-card px-3 py-2">
                            <p className="text-xs text-muted-foreground">{t(`homeroom.cells.${key}`)}</p>
                            <p className="text-xl font-bold tabular-nums">{counts[key]}</p>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <LoadingState />
            ) : error || !data ? (
                <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
            ) : data.data.length === 0 ? (
                <EmptyState icon={Users} title={t('attendance.emptyTitle')} description={t('homeroom.today.empty')} />
            ) : (
                <Card className="py-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-12 pl-5">{t('common.number')}</TableHead>
                                <TableHead>{t('common.fullName')}</TableHead>
                                <TableHead>{t('common.status')}</TableHead>
                                <TableHead>{t('attendance.in')}</TableHead>
                                <TableHead className="pr-5">{t('attendance.out')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.data.map((row, index) => (
                                <TableRow key={row.id}>
                                    <TableCell className="pl-5 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                                    <TableCell className="whitespace-normal">
                                        {row.person ? (
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="auto"
                                                className="font-semibold text-foreground hover:text-primary"
                                                onClick={() => setOpen({ personId: row.person!.id, ...row.person! })}
                                            >
                                                {personFullName(row.person)}
                                            </Button>
                                        ) : (
                                            t('attendance.noPerson')
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge tone={ATTENDANCE_TONE[row.attendanceStatus]}>{t(`attendance.status.${row.attendanceStatus}`)}</StatusBadge>
                                    </TableCell>
                                    <TableCell className="tabular-nums">{row.firstInTime ? formatTime(row.firstInTime) : '—'}</TableCell>
                                    <TableCell className="pr-5 tabular-nums">{row.lastOutTime ? formatTime(row.lastOutTime) : '—'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <StudentCardDialog classId={classId} student={open} onClose={() => setOpen(null)} />
        </div>
    );
}
