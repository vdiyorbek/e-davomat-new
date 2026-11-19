import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { addDays, formatDate, todayInTashkent, weekStart as mondayOf, weekdayName } from '@/lib/date';
import { cn } from '@/lib/utils';

interface WeekGridProps<T> {
    weekStart: string;
    lessons: T[];
    dateOf: (lesson: T) => string;
    keyOf: (lesson: T) => string;
    renderLesson: (lesson: T) => ReactNode;
    onWeekChange: (weekStart: string) => void;
}

/** Dushanba–shanba haftalik jadval, hafta bo‘yicha o‘tish bilan. */
export function WeekGrid<T>({ weekStart, lessons, dateOf, keyOf, renderLesson, onWeekChange }: WeekGridProps<T>) {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const days = Array.from({ length: 6 }, (_, index) => addDays(weekStart, index));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium tabular-nums">
                    {formatDate(days[0])} — {formatDate(days[5])}
                </p>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={t('cabinet.timetable.prevWeek')} onClick={() => onWeekChange(addDays(weekStart, -7))}>
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onWeekChange(mondayOf(today))}>
                        {t('cabinet.timetable.thisWeek')}
                    </Button>
                    <Button type="button" variant="outline" size="icon" aria-label={t('cabinet.timetable.nextWeek')} onClick={() => onWeekChange(addDays(weekStart, 7))}>
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {days.map((date, index) => {
                    const items = lessons.filter((lesson) => dateOf(lesson) === date);
                    return (
                        <section
                            key={date}
                            aria-label={weekdayName(index)}
                            className={cn('space-y-2 rounded-2xl border bg-card p-3 shadow-sm', date === today && 'border-primary ring-1 ring-primary/30')}
                        >
                            <h3 className="flex items-baseline justify-between gap-2">
                                <span className="font-heading font-bold">{weekdayName(index)}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{formatDate(date)}</span>
                            </h3>
                            {items.length === 0 ? (
                                <p className="py-3 text-center text-sm text-muted-foreground">{t('cabinet.timetable.noLessons')}</p>
                            ) : (
                                <ol className="list-none space-y-2">
                                    {items.map((lesson) => (
                                        <li key={keyOf(lesson)}>{renderLesson(lesson)}</li>
                                    ))}
                                </ol>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
