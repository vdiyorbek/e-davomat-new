import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPut } from '@/lib/auth-session';
import type { SchoolShift } from '@/types/school-class';

interface ShiftSettingsFormProps {
    schoolId: string;
    onCancel: () => void;
    onSaved: () => void;
}

function Editor({ initial, schoolId, onCancel, onSaved }: ShiftSettingsFormProps & { initial: SchoolShift[] }) {
    const { t } = useTranslation();
    const ids = useId();
    const [shifts, setShifts] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const saving = useRef(false);

    function change(code: number, field: 'startTime' | 'endTime', value: string) {
        setShifts((items) => items.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
        setError('');
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (saving.current) return;

        const invalid = shifts.find((item) => !item.startTime || !item.endTime || item.startTime >= item.endTime);
        if (invalid) {
            setError(t('classes.shift.timeOrder', { code: invalid.code }));
            return;
        }

        saving.current = true;
        setBusy(true);
        try {
            await authorizedPut(`/schools/${schoolId}/shifts`, {
                shifts: shifts.map(({ code, name, startTime, endTime }) => ({ code, name, startTime, endTime })),
            });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.shift.saveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
            {shifts.map((shift) => (
                <fieldset key={shift.code} className="space-y-3 rounded-xl border p-4">
                    <legend className="px-1 font-heading text-base font-bold">{t('classes.shift.nameN', { code: shift.code })}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field htmlFor={`${ids}-${shift.code}-start`} label={t('classes.shift.start')}>
                            <Input
                                id={`${ids}-${shift.code}-start`}
                                type="time"
                                value={shift.startTime}
                                disabled={busy}
                                onChange={(event) => change(shift.code, 'startTime', event.target.value)}
                            />
                        </Field>
                        <Field htmlFor={`${ids}-${shift.code}-end`} label={t('classes.shift.end')}>
                            <Input
                                id={`${ids}-${shift.code}-end`}
                                type="time"
                                value={shift.endTime}
                                disabled={busy}
                                onChange={(event) => change(shift.code, 'endTime', event.target.value)}
                            />
                        </Field>
                    </div>
                    {!shift.configured && <p className="text-xs text-muted-foreground">{t('classes.shift.defaultHint')}</p>}
                </fieldset>
            ))}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('common.save')}
                </Button>
            </div>
        </form>
    );
}

/** Maktabning 1- va 2-smena vaqtlari. */
export function ShiftSettingsForm(props: ShiftSettingsFormProps) {
    const { data, loading, error, retry } = useApiQuery<SchoolShift[]>(`/schools/${props.schoolId}/shifts`);

    if (loading) return <LoadingState rows={2} />;
    if (error) return <ErrorState message={error} onRetry={retry} />;
    if (!data) return null;

    return <Editor {...props} initial={data} />;
}
