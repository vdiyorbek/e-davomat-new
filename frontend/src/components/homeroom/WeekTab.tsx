import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { DayCellMark } from '@/components/homeroom/DayCellMark';
import { StudentCardDialog } from '@/components/homeroom/StudentCardDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { addDays, formatDate, todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomWeek } from '@/types/homeroom';


/** Kunlar bo‘yicha davomat jadvali: hafta yoki oy. */
export function WeekTab({ classId }: { classId: number }) {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const [mode, setMode] = useState<'week' | 'month'>('week');
    const [start, setStart] = useState(addDays(today, -6));
    const [open, setOpen] = useState<{ personId: number; firstName: string; lastName: string; middleName: string | null } | null>(null);

    const end = mode === 'week' ? addDays(start, 6) : addDays(start, 27);
    const { data, loading, error, retry } = useApiQuery<HomeroomWeek>(`/homeroom/classes/${classId}/week?from=${start}&to=${end}`);
    const step = mode === 'week' ? 7 : 28;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label={t('homeroom.week.prev')} onClick={() => setStart(addDays(start, -step))}>
                    <ChevronLeft aria-hidden="true" />
                </Button>
                <p className="min-w-44 text-center text-sm font-semibold tabular-nums">
                    {formatDate(start)} — {formatDate(end)}
                </p>
                <Button type="button" variant="outline" size="icon" aria-label={t('homeroom.week.next')} disabled={end >= today} onClick={() => setStart(addDays(start, step))}>
                    <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant={mode === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                        setMode('week');
                        setStart(addDays(today, -6));
                    }}
                >
                    {t('homeroom.week.week')}
                </Button>
                <Button
                    type="button"
                    variant={mode === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                        setMode('month');
                        setStart(addDays(today, -27));
                    }}
                >
                    {t('homeroom.week.month')}
                </Button>
            </div>

            <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(['present', 'absent', 'excused', 'dayoff', 'nodata'] as const).map((cell) => (
                    <li key={cell} className="flex items-center gap-1.5">
                        <DayCellMark cell={cell} className="size-5" />
                        {t(`homeroom.cells.${cell}`)}
                    </li>
                ))}
            </ul>

            {loading ? (
                <LoadingState />
            ) : error || !data ? (
                <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />
            ) : (
                <Card className="py-0">
                    <Table className="w-full">
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="sticky left-0 z-10 min-w-48 bg-muted pl-4">{t('common.fullName')}</TableHead>
                                {data.days.map((day) => (
                                    <TableHead key={day.date} className="px-1 text-center text-[11px] tabular-nums">
                                        {day.date.slice(8)}.{day.date.slice(5, 7)}
                                    </TableHead>
                                ))}
                                <TableHead className="px-3 text-center">%</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.students.map((student) => {
                                const base = student.present + student.absent;
                                return (
                                    <TableRow key={student.personId}>
                                        <TableCell className="sticky left-0 z-10 bg-card py-1.5 pl-4">
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="auto"
                                                className="font-medium text-foreground hover:text-primary"
                                                onClick={() => setOpen(student)}
                                            >
                                                {personFullName(student)}
                                            </Button>
                                        </TableCell>
                                        {student.cells.map((cell, index) => (
                                            <TableCell key={data.days[index].date} className="px-1 py-1.5 text-center">
                                                <DayCellMark cell={cell} className="mx-auto" />
                                            </TableCell>
                                        ))}
                                        <TableCell className="px-3 text-center font-semibold tabular-nums">
                                            {base > 0 ? `${Math.round((student.present / base) * 100)}%` : '—'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <StudentCardDialog classId={classId} student={open} onClose={() => setOpen(null)} />
        </div>
    );
}
