import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/button';
import { authorizedPatch } from '@/lib/auth-session';
import { useGradeOptions } from '@/lib/grades';
import type { SchoolClass } from '@/types/school-class';

export function GradeLevelEditor({ schoolClass, onSaved }: { schoolClass: SchoolClass; onSaved: () => void }) {
    const { t } = useTranslation();
    const gradeOptions = useGradeOptions();
    const [gradeLevel, setGradeLevel] = useState(schoolClass.gradeLevel == null ? '' : String(schoolClass.gradeLevel));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const saving = useRef(false);

    const unchanged = gradeLevel !== '' && Number(gradeLevel) === schoolClass.gradeLevel;

    async function handleSave() {
        if (saving.current || !gradeLevel || unchanged) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            await authorizedPatch(`/classes/${schoolClass.id}/grade-level`, { gradeLevel: Number(gradeLevel) });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.gradeSaveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <SelectField
                    value={gradeLevel}
                    onValueChange={(value) => {
                        setGradeLevel(value);
                        setError('');
                    }}
                    disabled={busy}
                    placeholder={t('common.notSet')}
                    options={gradeOptions}
                    aria-label={t('classes.gradeOf', { name: schoolClass.name })}
                    className="h-9 min-w-0 flex-1"
                />
                {!unchanged && gradeLevel && (
                    <Button type="button" size="sm" disabled={busy} onClick={() => void handleSave()}>
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                )}
            </div>
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}