import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/states';
import { InspectorCasePdf } from '@/components/inspector/InspectorCasePdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch, authorizedPost } from '@/lib/auth-session';
import { addDays, formatDate, todayInTashkent } from '@/lib/date';
import { CASE_CONTACTS, CASE_OUTCOMES, CASE_REASONS } from '@/types/inspector';
import type { InspectorCaseDetail } from '@/types/inspector';

interface Props {
    caseId: number | null;
    onClose: () => void;
    /** Ish saqlangan yoki yopilgan — ro‘yxatlarni yangilash uchun. */
    onChanged: (message?: string) => void;
}

export function InspectorCaseDialog({ caseId, onClose, onChanged }: Props) {
    const { t } = useTranslation();
    return (
        <Dialog open={caseId !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('inspectors.cases.dialog.title', { id: caseId ?? '' })}</DialogTitle>
                    <DialogDescription>{t('inspectors.cases.dialog.description')}</DialogDescription>
                </DialogHeader>
                {caseId !== null && <CaseBody key={caseId} caseId={caseId} onChanged={onChanged} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    );
}

function CaseBody({ caseId, onChanged, onClose }: { caseId: number; onChanged: Props['onChanged']; onClose: () => void }) {
    const query = useApiQuery<InspectorCaseDetail>(`/inspectors/me/cases/${caseId}`);
    if (query.loading) return <LoadingState />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    if (!query.data) return null;
    const refresh: Props['onChanged'] = (message) => {
        query.retry();
        onChanged(message);
    };
    return <CaseForm key={query.data.updatedAt} data={query.data} onChanged={refresh} onClose={onClose} />;
}

function CaseForm({ data, onChanged, onClose }: { data: InspectorCaseDetail; onChanged: Props['onChanged']; onClose: () => void }) {
    const { t } = useTranslation();
    const id = useId();
    const today = todayInTashkent();
    const closed = data.status === 'CLOSED';

    const [visitDate, setVisitDate] = useState(data.visitDate ?? '');
    const [spokeWith, setSpokeWith] = useState<string>(data.spokeWith ?? '');
    const [reason, setReason] = useState<string>(data.reason ?? '');
    const [findings, setFindings] = useState(data.findings ?? '');
    const [actionsTaken, setActionsTaken] = useState(data.actionsTaken ?? '');
    const [outcome, setOutcome] = useState<string>(data.outcome ?? '');
    const [followUpDate, setFollowUpDate] = useState(data.followUpDate ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [pdfOpen, setPdfOpen] = useState(false);

    const name = [data.student.lastName, data.student.firstName, data.student.middleName].filter(Boolean).join(' ');

    function payload() {
        return {
            ...(visitDate ? { visitDate } : {}),
            ...(spokeWith ? { spokeWith } : {}),
            ...(reason ? { reason } : {}),
            findings: findings.trim(),
            actionsTaken: actionsTaken.trim(),
            ...(outcome ? { outcome } : {}),
            ...(followUpDate ? { followUpDate } : {}),
        };
    }

    async function save(close: boolean) {
        if (busy) return;
        setError('');
        if (close) {
            if (!visitDate || !spokeWith || !reason || !outcome || findings.trim().length < 10) {
                return setError(t('inspectors.cases.errors.incomplete'));
            }
            if (outcome === 'STILL_ABSENT' && !followUpDate) {
                return setError(t('inspectors.cases.errors.followUpRequired'));
            }
        }
        setBusy(true);
        try {
            if (close) {
                await authorizedPost(`/inspectors/me/cases/${data.id}/close`, payload());
                onChanged(t('inspectors.cases.closedNotice'));
                onClose();
            } else {
                await authorizedPatch(`/inspectors/me/cases/${data.id}`, payload());
                onChanged(t('inspectors.cases.savedNotice'));
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('inspectors.cases.errors.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void save(false);
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold [overflow-wrap:anywhere]">{name}</p>
                    <StatusBadge tone={closed ? 'success' : 'warning'}>{t(`inspectors.cases.status.${data.status}`)}</StatusBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {data.student.school}
                    {data.student.className ? ` · ${data.student.className}` : ''}
                    {data.student.mahalla ? ` · ${data.student.mahalla}` : ''}
                </p>
                <p className="mt-2 text-sm">
                    {t('inspectors.cases.dialog.absence', { days: data.absentDays, since: formatDate(data.absentSince) })}
                </p>
                {data.history.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {t('inspectors.cases.dialog.history', { count: data.history.length })}
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-visit`} label={t('inspectors.cases.fields.visitDate')} required>
                        <Input
                            id={`${id}-visit`}
                            type="date"
                            min={data.absentSince}
                            max={today}
                            value={visitDate}
                            disabled={closed || busy}
                            onChange={(event) => setVisitDate(event.target.value)}
                        />
                    </Field>
                    <Field htmlFor={`${id}-with`} label={t('inspectors.cases.fields.spokeWith')} required>
                        <SelectField
                            id={`${id}-with`}
                            value={spokeWith}
                            onValueChange={setSpokeWith}
                            placeholder={t('inspectors.cases.fields.choose')}
                            disabled={closed || busy}
                            options={CASE_CONTACTS.map((value) => ({ value, label: t(`inspectors.cases.contact.${value}`) }))}
                        />
                    </Field>
                    <Field htmlFor={`${id}-reason`} label={t('inspectors.cases.fields.reason')} required className="sm:col-span-2">
                        <SelectField
                            id={`${id}-reason`}
                            value={reason}
                            onValueChange={setReason}
                            placeholder={t('inspectors.cases.fields.choose')}
                            disabled={closed || busy}
                            options={CASE_REASONS.map((value) => ({ value, label: t(`inspectors.cases.reason.${value}`) }))}
                        />
                    </Field>
                </div>

                <Field
                    htmlFor={`${id}-findings`}
                    label={t('inspectors.cases.fields.findings')}
                    hint={t('inspectors.cases.fields.findingsHint')}
                    required
                >
                    <Textarea
                        id={`${id}-findings`}
                        rows={4}
                        maxLength={3000}
                        value={findings}
                        disabled={closed || busy}
                        onChange={(event) => setFindings(event.target.value)}
                    />
                </Field>

                <Field htmlFor={`${id}-actions`} label={t('inspectors.cases.fields.actionsTaken')}>
                    <Textarea
                        id={`${id}-actions`}
                        rows={3}
                        maxLength={3000}
                        value={actionsTaken}
                        disabled={closed || busy}
                        onChange={(event) => setActionsTaken(event.target.value)}
                    />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-outcome`} label={t('inspectors.cases.fields.outcome')} required>
                        <SelectField
                            id={`${id}-outcome`}
                            value={outcome}
                            onValueChange={setOutcome}
                            placeholder={t('inspectors.cases.fields.choose')}
                            disabled={closed || busy}
                            options={CASE_OUTCOMES.map((value) => ({ value, label: t(`inspectors.cases.outcome.${value}`) }))}
                        />
                    </Field>
                    <Field
                        htmlFor={`${id}-follow`}
                        label={t('inspectors.cases.fields.followUp')}
                        hint={t('inspectors.cases.fields.followUpHint')}
                    >
                        <Input
                            id={`${id}-follow`}
                            type="date"
                            min={addDays(today, 1)}
                            value={followUpDate}
                            disabled={closed || busy}
                            onChange={(event) => setFollowUpDate(event.target.value)}
                        />
                    </Field>
                </div>

                {error && <ErrorState message={error} />}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setPdfOpen(true)}>
                        {t('inspectors.cases.pdf.open')}
                    </Button>
                    {!closed && (
                        <>
                            <Button type="submit" variant="outline" disabled={busy}>
                                {t('inspectors.cases.save')}
                            </Button>
                            <Button type="button" disabled={busy} onClick={() => void save(true)}>
                                {t('inspectors.cases.close')}
                            </Button>
                        </>
                    )}
                </div>
            </form>

            <InspectorCasePdf caseId={data.id} open={pdfOpen} onOpenChange={setPdfOpen} />
        </div>
    );
}
