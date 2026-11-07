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
import { todayInTashkent } from '@/lib/date';

const MAX_PDF_MB = 10;
const MAX_PDF_SIZE = MAX_PDF_MB * 1024 * 1024;

const SPOKE_WITH = ['FATHER', 'MOTHER', 'GUARDIAN', 'STUDENT'] as const;
const RESULTS = ['SOLVED', 'RECHECK', 'REFERRED'] as const;

export interface TalkStudent {
    personId: number;
    name: string;
    schoolName: string;
    className: string | null;
}

interface Props {
    student: TalkStudent;
    /** Boshlang'ich suhbat sanasi (ro'yxatda tanlangan kun). */
    defaultDate: string;
    onSaved: () => void;
    onCancel: () => void;
}

/** Backend bilan bir xil: keyingi sana suhbatdan keyin va 6 oydan oshmasin (server ham tekshiradi). */
function afterTalk(talkDate: string, followUp: string) {
    return followUp > talkDate;
}

export function InspectorTalkForm({ student, defaultDate, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const today = todayInTashkent();

    const [talkDate, setTalkDate] = useState(defaultDate);
    const [spokeWith, setSpokeWith] = useState('');
    const [reason, setReason] = useState('');
    const [result, setResult] = useState('');
    const [note, setNote] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setError('');

        const cleanReason = reason.trim();
        const cleanNote = note.trim();

        if (!talkDate || talkDate > today) return setError(t('inspectors.talk.errors.date'));
        if (!spokeWith) return setError(t('inspectors.talk.errors.spokeWith'));
        if (cleanReason.length < 3) return setError(t('inspectors.talk.errors.reason'));
        if (!result) return setError(t('inspectors.talk.errors.result'));
        if (followUpDate && !afterTalk(talkDate, followUpDate)) {
            return setError(t('inspectors.talk.errors.followUp'));
        }
        if (!file || file.size === 0) return setError(t('inspectors.talk.errors.file'));
        if (file.size > MAX_PDF_SIZE) {
            return setError(t('inspectors.talk.errors.fileSize', { size: MAX_PDF_MB }));
        }
        if (!file.name.toLowerCase().endsWith('.pdf') || (file.type !== '' && file.type !== 'application/pdf')) {
            return setError(t('inspectors.talk.errors.fileType'));
        }

        const payload = new FormData();
        payload.append('personId', String(student.personId));
        payload.append('talkDate', talkDate);
        payload.append('spokeWith', spokeWith);
        payload.append('reason', cleanReason);
        payload.append('result', result);
        if (cleanNote) payload.append('note', cleanNote);
        if (followUpDate) payload.append('followUpDate', followUpDate);
        payload.append('file', file);

        setSaving(true);
        try {
            await authorizedPost('/inspectors/me/talks', payload);
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('inspectors.talk.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('inspectors.talk.student')}</p>
                <p className="mt-1 font-semibold [overflow-wrap:anywhere]">{student.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {student.schoolName}
                    {student.className ? ` · ${student.className}` : ''}
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor={`${id}-date`} label={t('inspectors.talk.talkDate')} required>
                    <Input
                        id={`${id}-date`}
                        type="date"
                        required
                        max={today}
                        value={talkDate}
                        disabled={saving}
                        onChange={(event) => setTalkDate(event.target.value)}
                    />
                </Field>

                <Field htmlFor={`${id}-with`} label={t('inspectors.talk.spokeWith')} required>
                    <SelectField
                        id={`${id}-with`}
                        value={spokeWith}
                        onValueChange={setSpokeWith}
                        placeholder={t('inspectors.talk.chooseSpokeWith')}
                        disabled={saving}
                        options={SPOKE_WITH.map((value) => ({
                            value,
                            label: t(`inspectors.talk.spokeWithOptions.${value}`),
                        }))}
                    />
                </Field>
            </div>

            <Field htmlFor={`${id}-reason`} label={t('inspectors.talk.reason')} required>
                <Input
                    id={`${id}-reason`}
                    required
                    maxLength={255}
                    value={reason}
                    disabled={saving}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('inspectors.talk.reasonPlaceholder')}
                />
            </Field>

            <Field htmlFor={`${id}-result`} label={t('inspectors.talk.result')} required>
                <SelectField
                    id={`${id}-result`}
                    value={result}
                    onValueChange={setResult}
                    placeholder={t('inspectors.talk.chooseResult')}
                    disabled={saving}
                    options={RESULTS.map((value) => ({
                        value,
                        label: t(`inspectors.talk.resultOptions.${value}`),
                    }))}
                />
            </Field>

            <Field htmlFor={`${id}-note`} label={`${t('inspectors.talk.note')} (${t('common.optional')})`}>
                <Textarea
                    id={`${id}-note`}
                    rows={3}
                    maxLength={2000}
                    value={note}
                    disabled={saving}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('inspectors.talk.notePlaceholder')}
                />
            </Field>

            <Field
                htmlFor={`${id}-follow`}
                label={`${t('inspectors.talk.followUpDate')} (${t('common.optional')})`}
                hint={t('inspectors.talk.followUpHint')}
            >
                <Input
                    id={`${id}-follow`}
                    type="date"
                    min={talkDate}
                    value={followUpDate}
                    disabled={saving}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                />
            </Field>

            <Field
                htmlFor={`${id}-file`}
                label={t('inspectors.talk.file')}
                hint={t('inspectors.talk.fileHint', { size: MAX_PDF_MB })}
                required
            >
                <FileInput
                    id={`${id}-file`}
                    accept=".pdf,application/pdf"
                    file={file}
                    onFileChange={setFile}
                    disabled={saving}
                    icon={<FileText aria-hidden="true" />}
                    buttonLabel={t('inspectors.talk.chooseFile')}
                />
            </Field>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? t('common.saving') : t('inspectors.talk.submit')}
                </Button>
            </div>
        </form>
    );
}