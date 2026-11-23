import { useState } from 'react';
import { Pencil, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch } from '@/lib/auth-session';
import { personFullName } from '@/lib/person';
import type { SchoolClassRow } from '@/types/school-class';

interface Teacher {
    personId: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
}

function TeacherPicker({ item, onSaved, onClose }: { item: SchoolClassRow; onSaved: () => void; onClose: () => void }) {
    const { t } = useTranslation();
    const teachers = useApiQuery<Teacher[]>(`/classes/homeroom-teachers?schoolId=${item.schoolId}`);
    const [personId, setPersonId] = useState(item.homeroom ? String(item.homeroom.personId) : '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function save(next: number | null) {
        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/classes/${item.id}/homeroom`, { personId: next });
            onSaved();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.homeroom.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <Field htmlFor={`homeroom-${item.id}`} label={t('classes.homeroom.teacher')} hint={t('classes.homeroom.hint')}>
                <SelectField
                    id={`homeroom-${item.id}`}
                    value={personId}
                    onValueChange={setPersonId}
                    disabled={busy || teachers.loading}
                    searchable
                    placeholder={teachers.loading ? t('common.loading') : t('classes.homeroom.choose')}
                    options={(teachers.data ?? []).map((teacher) => ({
                        value: String(teacher.personId),
                        label: personFullName(teacher),
                    }))}
                />
            </Field>
            {teachers.error && <ErrorState message={teachers.error} onRetry={teachers.retry} />}
            {!teachers.loading && !teachers.error && (teachers.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">{t('classes.homeroom.noTeachers')}</p>
            )}
            {error && <ErrorState message={error} />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {item.homeroom && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void save(null)}>
                        {t('classes.homeroom.remove')}
                    </Button>
                )}
                <Button
                    type="button"
                    disabled={busy || !personId || personId === String(item.homeroom?.personId ?? '')}
                    onClick={() => void save(Number(personId))}
                >
                    {busy ? t('common.saving') : t('common.save')}
                </Button>
            </div>
        </div>
    );
}

/** Sinf rahbari: nom va (adminlar uchun) o‘zgartirish tugmasi. */
export function HomeroomCell({ item, canEdit, onSaved }: { item: SchoolClassRow; canEdit: boolean; onSaved: () => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <div className="flex min-w-0 items-center gap-2">
            <UserRoundCheck aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {item.homeroom ? (
                <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{item.homeroom.name}</span>
            ) : (
                <span className="text-sm text-muted-foreground">{t('classes.homeroom.none')}</span>
            )}
            {canEdit && (
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('classes.homeroom.change', { name: item.name })}
                        onClick={() => setOpen(true)}
                    >
                        <Pencil aria-hidden="true" />
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('classes.homeroom.title', { name: item.name })}</DialogTitle>
                                <DialogDescription>{t('classes.homeroom.description')}</DialogDescription>
                            </DialogHeader>
                            {open && <TeacherPicker item={item} onSaved={onSaved} onClose={() => setOpen(false)} />}
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
