import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPut } from '@/lib/auth-session';
import { formatDateTime } from '@/lib/date';
import type { LateSettings } from '@/types/dashboard';

function Author({ settings }: { settings: LateSettings }) {
    const { t } = useTranslation();
    if (!settings.updatedAt || !settings.updatedBy) return <span>{t('dashboard.late.default')}</span>;
    return (
        <span>
            {t('dashboard.late.changedBy', {
                name: settings.updatedBy.name ?? settings.updatedBy.login,
                role: t(`roles.${settings.updatedBy.role}`, { defaultValue: settings.updatedBy.role }),
                date: formatDateTime(settings.updatedAt),
            })}
        </span>
    );
}

/** Kechikish chegarasini ko‘rish va o‘zgartirish (bitta maktab). */
export function LateThresholdEditor({
    schoolId,
    settings,
    onSaved,
    compact,
}: {
    schoolId: number;
    settings: LateSettings;
    onSaved: () => void;
    compact?: boolean;
}) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(settings.minutes));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function save() {
        const minutes = Number(value);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
            setError(t('dashboard.late.invalid'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await authorizedPut(`/schools/${schoolId}/attendance-settings`, { lateThresholdMinutes: minutes });
            setEditing(false);
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('dashboard.late.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={compact ? 'space-y-1' : 'space-y-2'}>
            {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="number"
                        min={0}
                        max={120}
                        inputMode="numeric"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && void save()}
                        className="h-9 w-20"
                        aria-label={t('dashboard.late.minutesLabel')}
                        disabled={busy}
                    />
                    <span className="text-sm text-muted-foreground">{t('dashboard.late.minutes')}</span>
                    <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <span className={compact ? 'font-semibold tabular-nums' : 'font-heading text-2xl font-bold tabular-nums'}>
                        {t('dashboard.late.value', { count: settings.minutes })}
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
                        {t('dashboard.late.change')}
                    </Button>
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                <Author settings={settings} />
            </p>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

export function LateThresholdCard({ schoolId, settings, onSaved }: { schoolId: number; settings: LateSettings; onSaved: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {t('dashboard.late.hint')}
            </p>
            <LateThresholdEditor schoolId={schoolId} settings={settings} onSaved={onSaved} />
        </div>
    );
}
