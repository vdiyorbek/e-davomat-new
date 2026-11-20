import { useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPut } from '@/lib/auth-session';
import { parseLatLng } from '@/lib/geo';

/**
 * Maktab lokatsiyasi (xaritada ko‘rsatish uchun). Maktab administratori o‘z maktabini,
 * tuman/viloyat administratori o‘z hududidagilarini kiritadi — ruxsatni server tekshiradi.
 */
export function SchoolLocationEditor({
    schoolId,
    latitude,
    longitude,
    onSaved,
}: {
    schoolId: number;
    latitude: number | null | undefined;
    longitude: number | null | undefined;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const has = latitude != null && longitude != null;
    const current = has ? `${latitude}, ${longitude}` : '';
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(current);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function save() {
        const parsed = parseLatLng(value);
        if (parsed === 'invalid') {
            setError(t('schools.form.errors.coords'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await authorizedPut(`/schools/${schoolId}/location`, { latitude: parsed?.lat ?? null, longitude: parsed?.lng ?? null });
            setEditing(false);
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('schools.late.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1">
            {editing ? (
                <div className="space-y-1.5">
                    <Input
                        value={value}
                        onChange={(event) => {
                            setValue(event.target.value);
                            setError('');
                        }}
                        onKeyDown={(event) => event.key === 'Enter' && void save()}
                        placeholder="41.311081, 69.240562"
                        inputMode="decimal"
                        autoComplete="off"
                        className="h-9 w-full min-w-44"
                        aria-label={t('schools.form.location')}
                        disabled={busy}
                        autoFocus
                    />
                    <p className="text-[11px] leading-4 text-muted-foreground">{t('schools.location.hint')}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
                            {busy ? t('common.saving') : t('common.save')}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                                setEditing(false);
                                setValue(current);
                                setError('');
                            }}
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    {has ? (
                        <span className="flex items-center gap-1 text-sm tabular-nums">
                            <MapPin aria-hidden="true" className="size-3.5 text-success" />
                            {current}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-sm text-warning">
                            <MapPinOff aria-hidden="true" className="size-3.5" />
                            {t('schools.noLocation')}
                        </span>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
                        {has ? t('schools.late.change') : t('schools.location.enter')}
                    </Button>
                </div>
            )}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
