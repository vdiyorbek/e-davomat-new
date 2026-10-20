import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { FileInput } from '@/components/common/FileInput';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authorizedPost } from '@/lib/auth-session';
import { personFullName } from '@/lib/person';
import { EXCUSE_REASONS } from '@/types/attendance-excuse';
import type { ExcuseReason } from '@/types/attendance-excuse';
import type { DailyAttendance } from '@/types/daily-attendance';

export interface ExcuseStudentSelection {
    personId: number;
    schoolId: number;
    name: string;
    schoolName: string;
    className: string | null;
    defaultDate: string;
}

type Props = {
    onSaved: () => void;
    onCancel: () => void;
} & ({ item: DailyAttendance; selection?: never } | { item?: never; selection: ExcuseStudentSelection });

interface CreatedExcuse {
    id: number;
    status: 'ACTIVE';
}

const MAX_PDF_SIZE = 5 * 1024 * 1024;

export function AttendanceExcuseForm({ item, selection, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const student: ExcuseStudentSelection | null =
        selection ??
        (item?.person
            ? {
                personId: item.person.id,
                schoolId: item.schoolId,
                name: personFullName(item.person),
                schoolName: item.school.name,
                className: item.className,
                defaultDate: item.date,
            }
            : null);

    const [reason, setReason] = useState<ExcuseReason | ''>('');
    const [startDate, setStartDate] = useState(student?.defaultDate ?? '');
    const [endDate, setEndDate] = useState(student?.defaultDate ?? '');
    const [reasonNote, setReasonNote] = useState('');
    const [file, setFile] = useState<File | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !student) return;
        setError('');

        const note = reasonNote.trim();

        if (!reason) return setError(t('excuses.errors.reason'));
        if (!startDate || !endDate || endDate < startDate) return setError(t('excuses.errors.range'));
        if (note.length > 500) return setError(t('excuses.errors.noteLength'));
        if (!file || file.size === 0) return setError(t('excuses.errors.file'));
        if (file.size > MAX_PDF_SIZE) return setError(t('excuses.errors.fileSize', { size: 5 }));
        if (!file.name.toLowerCase().endsWith('.pdf') || (file.type !== '' && file.type !== 'application/pdf')) {
            return setError(t('excuses.errors.fileType'));
        }

        const payload = new FormData();
        payload.append('personId', String(student.personId));
        payload.append('schoolId', String(student.schoolId));
        payload.append('reason', reason);
        payload.append('startDate', startDate);
        payload.append('endDate', endDate);
        if (note) payload.append('reasonNote', note);
        payload.append('file', file);

        setSaving(true);
        try {
            await authorizedPost<CreatedExcuse>('/attendance-excuses', payload);
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('excuses.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('excuses.selectedStudent')}</p>
                <p className="mt-1 font-semibold [overflow-wrap:anywhere]">{student?.name ?? t('excuses.unknownStudent')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {student?.schoolName ?? '—'}
                    {student?.className ? ` · ${student.className}` : ''}
                </p>
            </div>

            <Field htmlFor={`${id}-reason`} label={t('excuses.reasonType')} required>
                <SelectField
                    id={`${id}-reason`}
                    value={reason}
                    onValueChange={(value) => setReason(value as ExcuseReason)}
                    placeholder={t('excuses.chooseReason')}
                    required
                    disabled={saving}
                    options={EXCUSE_REASONS.map((value) => ({ value, label: t(`excuses.reason.${value}`) }))}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-start`} label={t('membership.startDate')} required>
                    <Input id={`${id}-start`} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
                </Field>
                <Field htmlFor={`${id}-end`} label={t('membership.endDate')} required>
                    <Input id={`${id}-end`} type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={saving} />
                </Field>
            </div>

            <Field htmlFor={`${id}-note`} label={`${t('excuses.note')} (${t('common.optional')})`} hint={t('excuses.noteHint')}>
                <Textarea
                    id={`${id}-note`}
                    maxLength={500}
                    rows={3}
                    disabled={saving}
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    placeholder={t('excuses.notePlaceholder')}
                />
            </Field>

            <Field htmlFor={`${id}-file`} label={t('excuses.file')} hint={t('excuses.fileHint', { size: 5 })} required>
                <FileInput
                    id={`${id}-file`}
                    accept=".pdf,application/pdf"
                    file={file}
                    onFileChange={setFile}
                    disabled={saving}
                    icon={<FileText aria-hidden="true" />}
                    buttonLabel={t('excuses.chooseFile')}
                />
            </Field>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? t('common.saving') : t('excuses.submit')}
                </Button>
            </div>
        </form>
    );
}
