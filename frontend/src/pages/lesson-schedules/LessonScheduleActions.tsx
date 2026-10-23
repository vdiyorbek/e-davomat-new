import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarX2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authorizedDelete, authorizedPatch } from '@/lib/auth-session';
import { addDays, formatDate, todayInTashkent, weekdayName } from '@/lib/date';
import { localizedName } from '@/lib/localized';

import { SCHOOL_DAYS } from './schedule-utils';

interface Lesson {
    id: number;
    dayOfWeek: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string | null;
    subject: { nameUz: string };
}

interface Props {
    lesson: Lesson;
    onUpdated: () => void;
}

/** Eng erta ruxsat etilgan o‘zgarish sanasi: bugun yoki dars boshlanganidan keyingi kun. */
function earliestChangeDate(lesson: Lesson): string {
    const afterStart = addDays(lesson.startDate, 1);
    const today = todayInTashkent();
    return today > afterStart ? today : afterStart;
}

export function LessonScheduleActions({ lesson, onUpdated }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const subject = localizedName(lesson.subject);
    const minDate = earliestChangeDate(lesson);
    const maxDate = lesson.endDate ? addDays(lesson.endDate, -1) : undefined;

    const [mode, setMode] = useState<'edit' | 'cancel' | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [dayOfWeek, setDayOfWeek] = useState(String(lesson.dayOfWeek));
    const [lessonNumber, setLessonNumber] = useState(String(lesson.lessonNumber));
    const [startTime, setStartTime] = useState(lesson.startTime.slice(0, 5));
    const [endTime, setEndTime] = useState(lesson.endTime.slice(0, 5));
    const [effectiveDate, setEffectiveDate] = useState(minDate);

    function open(next: 'edit' | 'cancel') {
        setDayOfWeek(String(lesson.dayOfWeek));
        setLessonNumber(String(lesson.lessonNumber));
        setStartTime(lesson.startTime.slice(0, 5));
        setEndTime(lesson.endTime.slice(0, 5));
        setEffectiveDate(minDate);
        setError('');
        setMode(next);
    }

    function validDate(): boolean {
        if (!effectiveDate || effectiveDate < minDate || (maxDate && effectiveDate > maxDate)) {
            setError(t('schedule.errors.effectiveDate', { date: formatDate(minDate) }));
            return false;
        }
        return true;
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');

        const number = Number(lessonNumber);
        if (!Number.isInteger(number) || number < 1 || number > 20) return setError(t('schedule.errors.lessonNumber'));
        if (startTime >= endTime) return setError(t('schedule.errors.time'));
        if (!validDate()) return;

        setBusy(true);
        try {
            await authorizedPatch(`/lesson-schedules/${lesson.id}`, {
                effectiveDate,
                dayOfWeek: Number(dayOfWeek),
                lessonNumber: number,
                startTime,
                endTime,
            });
            setMode(null);
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('schedule.errors.updateFailed'));
        } finally {
            setBusy(false);
        }
    }

    async function handleCancel(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        if (!validDate()) return;

        setBusy(true);
        try {
            await authorizedDelete(`/lesson-schedules/${lesson.id}?effectiveDate=${encodeURIComponent(effectiveDate)}`);
            setMode(null);
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('schedule.errors.cancelFailed'));
        } finally {
            setBusy(false);
        }
    }

    const dateField = (
        <Field
            htmlFor={`${id}-effective`}
            label={mode === 'cancel' ? t('schedule.cancel.date') : t('schedule.edit.effectiveDate')}
            hint={mode === 'cancel' ? t('schedule.cancel.hint') : t('schedule.edit.effectiveHint')}
            required
        >
            <Input
                id={`${id}-effective`}
                type="date"
                value={effectiveDate}
                min={minDate}
                max={maxDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                disabled={busy}
                required
            />
        </Field>
    );

    return (
        <>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => open('edit')}>
                    <Pencil aria-hidden="true" />
                    {t('common.edit')}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => open('cancel')}>
                    <CalendarX2 aria-hidden="true" />
                    {t('schedule.cancel.button')}
                </Button>
            </div>

            <Dialog open={mode !== null} onOpenChange={(next) => !busy && !next && setMode(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{mode === 'cancel' ? t('schedule.cancel.title') : t('schedule.edit.title')}</DialogTitle>
                        <DialogDescription>
                            {t('schedule.lessonLabel', { n: lesson.lessonNumber, subject })} · {weekdayName(lesson.dayOfWeek - 1)}
                        </DialogDescription>
                    </DialogHeader>

                    {mode === 'cancel' ? (
                        <form className="space-y-4" onSubmit={(event) => void handleCancel(event)}>
                            {dateField}
                            {error && <ErrorState message={error} />}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>
                                    {t('common.back')}
                                </Button>
                                <Button type="submit" variant="destructive" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy}>
                                    {busy ? t('common.saving') : t('schedule.cancel.confirm')}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field htmlFor={`${id}-day`} label={t('schedule.weekday')} required>
                                    <SelectField
                                        id={`${id}-day`}
                                        value={dayOfWeek}
                                        onValueChange={setDayOfWeek}
                                        disabled={busy}
                                        options={SCHOOL_DAYS.map((day) => ({ value: String(day), label: weekdayName(day - 1) }))}
                                    />
                                </Field>
                                <Field htmlFor={`${id}-number`} label={t('schedule.lessonNumber')} required>
                                    <Input
                                        id={`${id}-number`}
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={20}
                                        value={lessonNumber}
                                        onChange={(event) => setLessonNumber(event.target.value)}
                                        disabled={busy}
                                        required
                                    />
                                </Field>
                                <Field htmlFor={`${id}-start`} label={t('schedule.startTime')} required>
                                    <Input id={`${id}-start`} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={busy} required />
                                </Field>
                                <Field htmlFor={`${id}-end`} label={t('schedule.endTime')} required>
                                    <Input id={`${id}-end`} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} disabled={busy} required />
                                </Field>
                            </div>
                            {dateField}
                            {error && <ErrorState message={error} />}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={busy}>
                                    {busy ? t('common.saving') : t('common.save')}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
