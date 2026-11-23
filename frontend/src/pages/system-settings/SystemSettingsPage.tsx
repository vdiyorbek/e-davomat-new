import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedDelete, authorizedPut } from '@/lib/auth-session';
import { formatDateTime } from '@/lib/date';
import type { SettingGroup, SystemSetting, SystemSettingHistory } from '@/types/system-settings';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

const GROUPS: SettingGroup[] = ['calendar', 'photos', 'push', 'lag', 'live'];

function displayValue(value: number | boolean, yes: string, no: string): string {
    return typeof value === 'boolean' ? (value ? yes : no) : String(value);
}

function SettingRow({ setting, onChanged }: { setting: SystemSetting; onChanged: (next: SystemSetting) => void }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<string | boolean>(typeof setting.value === 'boolean' ? setting.value : String(setting.value));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const current = typeof setting.value === 'boolean' ? setting.value : String(setting.value);
    const changed = draft !== current;
    const unit = setting.unit ? t(`systemSettings.units.${setting.unit}`) : '';

    async function save() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const value = typeof draft === 'boolean' ? draft : Number(draft);
            const next = await authorizedPut<SystemSetting>(`/system-settings/${setting.key}`, { value });
            setDraft(typeof next.value === 'boolean' ? next.value : String(next.value));
            onChanged(next);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('systemSettings.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    async function reset() {
        if (busy || !window.confirm(t('systemSettings.confirmReset'))) return;
        setBusy(true);
        setError('');
        try {
            const next = await authorizedDelete<SystemSetting>(`/system-settings/${setting.key}`);
            setDraft(typeof next.value === 'boolean' ? next.value : String(next.value));
            onChanged(next);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('systemSettings.saveFailed'));
        } finally {
            setBusy(false);
        }
    }

    const inputId = `setting-${setting.key}`;

    return (
        <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={inputId} className="text-sm font-semibold">
                        {t(`systemSettings.items.${setting.key}.label`)}
                    </Label>
                    <StatusBadge tone={setting.overridden ? 'primary' : 'neutral'} dot={false}>
                        {setting.overridden ? t('systemSettings.changed') : t('systemSettings.standard')}
                    </StatusBadge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{t(`systemSettings.items.${setting.key}.hint`)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {t('systemSettings.defaultIs', { value: `${displayValue(setting.default, t('systemSettings.on'), t('systemSettings.off'))}${unit ? ` ${unit}` : ''}` })}
                    {setting.type === 'int' && setting.min !== null && setting.max !== null && ` · ${t('systemSettings.range', { min: setting.min, max: setting.max })}`}
                </p>
                {setting.overridden && setting.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                        {t('systemSettings.changedBy', {
                            who: setting.updatedBy ? (setting.updatedBy.name ?? setting.updatedBy.login) : '—',
                            date: formatDateTime(setting.updatedAt),
                        })}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {setting.type === 'bool' ? (
                    <div className="flex items-center gap-2">
                        <Switch id={inputId} checked={draft === true} onCheckedChange={(checked) => setDraft(checked)} disabled={busy} />
                        <span className="min-w-20 text-sm">{draft === true ? t('systemSettings.on') : t('systemSettings.off')}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Input
                            id={inputId}
                            type="number"
                            inputMode="numeric"
                            min={setting.min ?? undefined}
                            max={setting.max ?? undefined}
                            step={1}
                            value={String(draft)}
                            onChange={(event) => setDraft(event.target.value)}
                            disabled={busy}
                            className="h-9 w-32 tabular-nums"
                        />
                        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
                    </div>
                )}
                <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !changed || draft === ''}>
                    {busy ? t('common.saving') : t('common.save')}
                </Button>
                {setting.overridden && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void reset()} disabled={busy}>
                        <RotateCcw aria-hidden="true" />
                        {t('systemSettings.reset')}
                    </Button>
                )}
            </div>
        </li>
    );
}

function History() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-base font-bold">{t('systemSettings.history.title')}</h2>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
                    {open ? t('systemSettings.history.hide') : t('systemSettings.history.show')}
                </Button>
            </div>
            {open && <HistoryTable />}
        </section>
    );
}

function HistoryTable() {
    const { t } = useTranslation();
    const query = useApiQuery<SystemSettingHistory[]>('/system-settings/history?limit=50');
    if (query.loading) return <LoadingState rows={3} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    const rows = query.data ?? [];
    if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t('systemSettings.history.empty')}</p>;
    const show = (value: string | null) => (value === null ? t('systemSettings.history.standard') : value === 'true' ? t('systemSettings.on') : value === 'false' ? t('systemSettings.off') : value);
    return (
        <div className="overflow-x-auto">
            <Table className="w-full min-w-[520px] text-sm">
                <TableHeader>
                    <TableRow className="text-left text-xs text-muted-foreground">
                        <TableHead className="py-2 pr-3 font-medium">{t('systemSettings.history.date')}</TableHead>
                        <TableHead className="py-2 pr-3 font-medium">{t('systemSettings.history.setting')}</TableHead>
                        <TableHead className="py-2 pr-3 font-medium">{t('systemSettings.history.change')}</TableHead>
                        <TableHead className="py-2 font-medium">{t('systemSettings.history.who')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id} className="border-t">
                            <TableCell className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatDateTime(row.changedAt)}</TableCell>
                            <TableCell className="py-2 pr-3">{t(`systemSettings.items.${row.key}.label`, { defaultValue: row.key })}</TableCell>
                            <TableCell className="py-2 pr-3 tabular-nums">
                                {show(row.oldValue)} → {show(row.newValue)}
                            </TableCell>
                            <TableCell className="py-2">{row.changedBy ? (row.changedBy.name ?? row.changedBy.login) : '—'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function SystemSettingsPage() {
    const { t } = useTranslation();
    const query = useApiQuery<SystemSetting[]>('/system-settings');
    // Saqlangan qiymat serverdan qaytadi; ro‘yxatni to‘liq qayta yuklamasdan yangilaymiz.
    const [updated, setUpdated] = useState<Record<string, SystemSetting>>({});
    const all = query.data ?? [];

    return (
        <div className="w-full min-w-0 space-y-5 sm:space-y-6">
            <PageHeader eyebrow={t('systemSettings.eyebrow')} title={t('systemSettings.title')} description={t('systemSettings.description')} />

            {query.loading && <LoadingState rows={6} />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}

            {all.length > 0 &&
                GROUPS.map((group) => {
                    const items = all.filter((setting) => setting.group === group).map((setting) => updated[setting.key] ?? setting);
                    if (items.length === 0) return null;
                    return (
                        <section key={group} aria-labelledby={`group-${group}`} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                            <h2 id={`group-${group}`} className="font-heading text-base font-bold">
                                {t(`systemSettings.groups.${group}.title`)}
                            </h2>
                            <p className="text-xs text-muted-foreground">{t(`systemSettings.groups.${group}.description`)}</p>
                            <ul className="mt-2 list-none divide-y">
                                {items.map((setting) => (
                                    <SettingRow
                                        // Qiymat serverdan o‘zgarganda qator holati yangilanishi uchun.
                                        key={`${setting.key}:${String(setting.value)}:${setting.overridden}`}
                                        setting={setting}
                                        onChanged={(next) => setUpdated((prev) => ({ ...prev, [next.key]: next }))}
                                    />
                                ))}
                            </ul>
                        </section>
                    );
                })}

            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">{t('systemSettings.secretsNote')}</p>

            <History />
        </div>
    );
}
