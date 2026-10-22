
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import {
    authorizedDelete,
    authorizedPatch,
} from '@/lib/auth-session';

const DAYS = [
    'Dushanba',
    'Seshanba',
    'Chorshanba',
    'Payshanba',
    'Juma',
    'Shanba',
];

interface Lesson {
    id: number;
    dayOfWeek: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string | null;
    subject: {
        nameUz: string;
    };
}

interface Props {
    lesson: Lesson;
    onUpdated: () => void;
}

export function LessonScheduleActions({
    lesson,
    onUpdated,
}: Props) {
    const id = useId();

    const { confirm, dialog } = useConfirm();

    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [dayOfWeek, setDayOfWeek] = useState(
        String(lesson.dayOfWeek),
    );

    const [lessonNumber, setLessonNumber] = useState(
        String(lesson.lessonNumber),
    );

    const [startTime, setStartTime] = useState(
        lesson.startTime.slice(0, 5),
    );

    const [endTime, setEndTime] = useState(
        lesson.endTime.slice(0, 5),
    );

    const [startDate, setStartDate] = useState(
        lesson.startDate,
    );

    const [endDate, setEndDate] = useState(
        lesson.endDate ?? '',
    );

    function startEditing() {
        setDayOfWeek(String(lesson.dayOfWeek));
        setLessonNumber(String(lesson.lessonNumber));
        setStartTime(lesson.startTime.slice(0, 5));
        setEndTime(lesson.endTime.slice(0, 5));
        setStartDate(lesson.startDate);
        setEndDate(lesson.endDate ?? '');
        setError('');

        setEditing(true);
    }

    async function handleSave(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (busy) return;

        setError('');

        if (!Number.isInteger(Number(lessonNumber)) ||
            Number(lessonNumber) < 1 ||
            Number(lessonNumber) > 20) {
            setError('Dars raqami 1 dan 20 gacha bo‘lishi kerak.');
            return;
        }

        if (startTime >= endTime) {
            setError(
                'Dars tugash vaqti boshlanishidan keyin bo‘lishi kerak.',
            );
            return;
        }

        if (endDate && endDate <= startDate) {
            setError(
                'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.',
            );
            return;
        }

        setBusy(true);

        try {
            await authorizedPatch(
                `/lesson-schedules/${lesson.id}`,
                {
                    dayOfWeek: Number(dayOfWeek),
                    lessonNumber: Number(lessonNumber),
                    startTime,
                    endTime,
                    startDate,
                    endDate: endDate || null,
                },
            );

            setEditing(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Darsni tahrirlashda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete() {
        if (busy) return;

        const confirmed = await confirm({
            title: 'Darsni bekor qilish',
            description:
                `${lesson.subject.nameUz} fanining ` +
                `${lesson.lessonNumber}-darsini ` +
                'jadvaldan bekor qilmoqchimisiz? ' +
                'Yozuv bazada saqlanadi, lekin faol ' +
                'jadvalda ko‘rinmaydi.',
            confirmLabel: 'Bekor qilish',
            destructive: true,
        });

        if (!confirmed) return;

        setBusy(true);
        setError('');

        try {
            await authorizedDelete(
                `/lesson-schedules/${lesson.id}`,
            );

            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Darsni bekor qilishda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {dialog}

            <div className="mt-3 space-y-2">
                {error && !editing && (
                    <p
                        role="alert"
                        className="text-sm text-destructive break-words"
                    >
                        {error}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={startEditing}
                    >
                        <Pencil aria-hidden="true" />
                        Tahrirlash
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete()}
                    >
                        <Trash2 aria-hidden="true" />
                        Bekor qilish
                    </Button>
                </div>
            </div>

            <Dialog
                open={editing}
                onOpenChange={(open) => {
                    if (!busy) setEditing(open);
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Darsni tahrirlash
                        </DialogTitle>

                        <DialogDescription>
                            {lesson.subject.nameUz} — dars vaqti,
                            kuni va amal qilish davrini o‘zgartirish
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="space-y-4"
                        onSubmit={(event) => void handleSave(event)}
                    >
                        <Field
                            htmlFor={`${id}-day`}
                            label="Hafta kuni"
                            required
                        >
                            <SelectField
                                id={`${id}-day`}
                                value={dayOfWeek}
                                onValueChange={setDayOfWeek}
                                disabled={busy}
                                options={DAYS.map((day, index) => ({
                                    value: String(index + 1),
                                    label: day,
                                }))}
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-number`}
                            label="Dars raqami"
                            required
                        >
                            <Input
                                id={`${id}-number`}
                                type="number"
                                min={1}
                                max={20}
                                value={lessonNumber}
                                onChange={(event) =>
                                    setLessonNumber(event.target.value)
                                }
                                disabled={busy}
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                htmlFor={`${id}-start-time`}
                                label="Boshlanish"
                                required
                            >
                                <Input
                                    id={`${id}-start-time`}
                                    type="time"
                                    value={startTime}
                                    onChange={(event) =>
                                        setStartTime(event.target.value)
                                    }
                                    disabled={busy}
                                    required
                                />
                            </Field>

                            <Field
                                htmlFor={`${id}-end-time`}
                                label="Tugash"
                                required
                            >
                                <Input
                                    id={`${id}-end-time`}
                                    type="time"
                                    value={endTime}
                                    onChange={(event) =>
                                        setEndTime(event.target.value)
                                    }
                                    disabled={busy}
                                    required
                                />
                            </Field>
                        </div>

                        <Field
                            htmlFor={`${id}-start-date`}
                            label="Amal qilish boshlanishi"
                            required
                        >
                            <Input
                                id={`${id}-start-date`}
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    setStartDate(event.target.value)
                                }
                                disabled={busy}
                                required
                            />
                        </Field>

                        <Field
                            htmlFor={`${id}-end-date`}
                            label="Amal qilish tugashi (ixtiyoriy)"
                        >
                            <Input
                                id={`${id}-end-date`}
                                type="date"
                                value={endDate}
                                onChange={(event) =>
                                    setEndDate(event.target.value)
                                }
                                disabled={busy}
                            />
                        </Field>

                        {error && <ErrorState message={error} />}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setEditing(false)}
                            >
                                Yopish
                            </Button>

                            <Button
                                type="submit"
                                disabled={busy}
                            >
                                {busy
                                    ? 'Saqlanmoqda...'
                                    : 'O‘zgarishlarni saqlash'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
