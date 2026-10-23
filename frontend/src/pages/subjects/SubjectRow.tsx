import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, Pencil, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authorizedPatch } from '@/lib/auth-session';

import { SubjectFields } from './subject-form';
import { validateSubject } from './subject-validation';
import type { Subject } from './subject-form';

interface Props {
    subject: Subject;
    onUpdated: () => void;
}

/** Fan uchun amallar: tahrirlash oynasi va arxivlash / tiklash. */
export function SubjectActions({ subject, onUpdated }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { confirm, dialog } = useConfirm();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [values, setValues] = useState({ code: subject.code, nameUz: subject.nameUz, nameRu: subject.nameRu ?? '' });

    function startEditing() {
        setValues({ code: subject.code, nameUz: subject.nameUz, nameRu: subject.nameRu ?? '' });
        setError('');
        setEditing(true);
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const invalid = validateSubject(values);
        if (invalid) return setError(t(invalid));

        setBusy(true);
        setError('');
        try {
            await authorizedPatch<Subject>(`/subjects/${subject.id}`, {
                code: values.code.trim().toUpperCase(),
                nameUz: values.nameUz.trim(),
                nameRu: values.nameRu.trim() || null,
            });
            setEditing(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('subjects.errors.updateFailed'));
        } finally {
            setBusy(false);
        }
    }

    async function toggleActive() {
        if (busy) return;
        if (subject.isActive) {
            const confirmed = await confirm({
                title: t('subjects.archiveTitle'),
                description: t('subjects.archiveConfirm', { name: subject.nameUz }),
                confirmLabel: t('subjects.archive'),
                destructive: true,
            });
            if (!confirmed) return;
        }
        setBusy(true);
        setError('');
        try {
            await authorizedPatch<Subject>(`/subjects/${subject.id}`, { isActive: !subject.isActive });
            onUpdated();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('subjects.errors.statusFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-2">
            {dialog}
            <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={startEditing}>
                    <Pencil aria-hidden="true" />
                    {t('common.edit')}
                </Button>
                <Button type="button" size="sm" variant={subject.isActive ? 'destructive' : 'secondary'} disabled={busy} onClick={() => void toggleActive()}>
                    {subject.isActive ? <Archive aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                    {subject.isActive ? t('subjects.archive') : t('subjects.restore')}
                </Button>
            </div>
            {!editing && error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <Dialog open={editing} onOpenChange={(open) => !busy && setEditing(open)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('subjects.editTitle')}</DialogTitle>
                        <DialogDescription>{subject.nameUz}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
                        <SubjectFields idPrefix={id} values={values} onChange={setValues} disabled={busy} />
                        {error && <ErrorState message={error} />}
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
