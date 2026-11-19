import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authorizedPut } from '@/lib/auth-session';
import type { ShiftCode } from '@/types/school-class';

interface AssignResult {
    requested: number;
    changed: number;
}

interface ClassShiftBarProps {
    selected: number[];
    onClear: () => void;
    onAssigned: (message: string) => void;
}

/** Tanlangan sinflarni bir bosishda 1- yoki 2-smenaga o‘tkazish (bugundan). */
export function ClassShiftBar({ selected, onClear, onAssigned }: ClassShiftBarProps) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<ShiftCode | null>(null);
    const [error, setError] = useState('');
    const saving = useRef(false);

    async function assign(shiftCode: ShiftCode) {
        if (saving.current || selected.length === 0) return;
        saving.current = true;
        setBusy(shiftCode);
        setError('');
        try {
            const result = await authorizedPut<AssignResult>('/classes/shifts', { classIds: selected, shiftCode });
            onAssigned(t('classes.shift.assigned', { count: result.requested, code: shiftCode }));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('classes.shift.assignFailed'));
        } finally {
            saving.current = false;
            setBusy(null);
        }
    }

    if (selected.length === 0) return null;

    return (
        <div
            role="region"
            aria-label={t('classes.shift.barLabel')}
            className="sticky bottom-20 z-20 flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between lg:bottom-4"
        >
            <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" aria-label={t('classes.shift.clearSelection')} onClick={onClear}>
                    <X aria-hidden="true" />
                </Button>
                <p className="text-sm font-medium">{t('classes.shift.selected', { count: selected.length })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {error && (
                    <p role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                )}
                {([1, 2] as const).map((code) => (
                    <Button key={code} type="button" disabled={busy !== null} onClick={() => void assign(code)}>
                        {busy === code ? t('common.saving') : t('classes.shift.moveTo', { code })}
                    </Button>
                ))}
            </div>
        </div>
    );
}
