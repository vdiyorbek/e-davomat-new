import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authorizedPatch } from '@/lib/auth-session';
import { todayInTashkent } from '@/lib/date';
import { TALK_RESULTS, TALK_SPOKE_WITH } from '@/types/inspector';
import type { InspectorTalkItem } from '@/types/inspector';

interface Props {
    talk: InspectorTalkItem;
    onSaved: () => void;
    onCancel: () => void;
}

export function InspectorTalkEditForm({ talk, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const today = todayInTashkent();

    const [talkDate, setTalkDate] = useState(talk.talkDate);
    const [spokeWith, setSpokeWith] = useState<string>(talk.spokeWith);
    const [reason, setReason] = useState(talk.reason);
    const [result, setResult] = useState<string>(talk.result);
    const [note, setNote] = useState(talk.note ?? '');
    const [followUpDate, setFollowUpDate] = useState(talk.followUpDate ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setError('');

        const cleanReason = reason.trim();

        if (!talkDate || talkDate > today) return setError(t('inspectors.talk.errors.date'));
        if (cleanReason.length < 3) return setError(t('inspectors.talk.errors.reason'));
        if (followUpDate && followUpDate <= talkDate) return setError(t('inspectors.talk.errors.followUp'));

        setSaving(true);
        try {
            await authorizedPatch(`/inspectors/me/talks/${talk.id}`, {
                talkDate,
                spokeWith,
                reason: cleanReason,
                result,
                note: note.trim() || null,
                followUpDate: followUpDate || null,
            });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('inspectors.talk.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
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
                        disabled={saving}
                        options={TALK_SPOKE_WITH.map((value) => ({
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
                />
            </Field>

            <Field htmlFor={`${id}-result`} label={t('inspectors.talk.result')} required>
                <SelectField
                    id={`${id}-result`}
                    value={result}
                    onValueChange={setResult}
                    disabled={saving}
                    options={TALK_RESULTS.map((value) => ({
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