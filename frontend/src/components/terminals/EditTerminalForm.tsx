import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateTerminal } from '@/lib/terminals-api';
import type { Terminal, TerminalDirection, TerminalProtocol } from '@/types/terminal';

interface Props {
    terminal: Terminal;
    onSaved: () => void;
    onCancel: () => void;
}

export function EditTerminalForm({ terminal, onSaved, onCancel }: Props) {
    const { t } = useTranslation();
    const id = useId();

    const [name, setName] = useState(terminal.name);
    const [direction, setDirection] = useState<TerminalDirection>(terminal.direction);
    const [protocol, setProtocol] = useState<TerminalProtocol>(terminal.protocol);
    const [host, setHost] = useState(terminal.host);
    const [port, setPort] = useState(String(terminal.port));
    const [username, setUsername] = useState(terminal.username);
    const [password, setPassword] = useState('');
    const [isActive, setIsActive] = useState(terminal.isActive);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const portNumber = Number(port);
        if (name.trim().length < 2 || !host.trim() || !username.trim()) {
            setError(t('terminals.form.errors.required'));
            return;
        }
        if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
            setError(t('terminals.form.errors.port'));
            return;
        }

        setSaving(true);
        setError('');
        try {
            await updateTerminal(terminal.id, {
                name: name.trim(),
                direction,
                protocol,
                host: host.trim(),
                port: portNumber,
                username: username.trim(),
                isActive,
                ...(password ? { password } : {}),
            });
            onSaved();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.form.errors.updateFailed'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <p className="font-semibold break-words">{terminal.school.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {terminal.school.region.name} / {terminal.school.district.name} · <span className="font-mono">#{terminal.id}</span>
                    </p>
                </div>
            </div>

            <fieldset disabled={saving} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-name`} label={t('terminals.form.name')} required>
                        <Input
                            id={`${id}-name`}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            minLength={2}
                            maxLength={150}
                            required
                        />
                    </Field>
                    <Field htmlFor={`${id}-direction`} label={t('terminals.direction')}>
                        <SelectField
                            id={`${id}-direction`}
                            value={direction}
                            onValueChange={(value) => setDirection(value === 'OUT' ? 'OUT' : 'IN')}
                            options={[
                                { value: 'IN', label: t('terminals.directions.IN') },
                                { value: 'OUT', label: t('terminals.directions.OUT') },
                            ]}
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <Field htmlFor={`${id}-host`} label={t('terminals.form.host')} hint={t('terminals.form.hostHint')} required>
                        <Input
                            id={`${id}-host`}
                            value={host}
                            onChange={(event) => setHost(event.target.value)}
                            placeholder="192.168.1.100"
                            autoComplete="off"
                            inputMode="url"
                            maxLength={253}
                            className="font-mono"
                            required
                        />
                    </Field>
                    <Field htmlFor={`${id}-protocol`} label={t('terminals.form.protocol')}>
                        <SelectField
                            id={`${id}-protocol`}
                            value={protocol}
                            onValueChange={(value) => setProtocol(value === 'HTTPS' ? 'HTTPS' : 'HTTP')}
                            options={[
                                { value: 'HTTP', label: 'HTTP' },
                                { value: 'HTTPS', label: 'HTTPS' },
                            ]}
                        />
                    </Field>
                    <Field htmlFor={`${id}-port`} label={t('terminals.form.port')} required>
                        <Input
                            id={`${id}-port`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={65535}
                            step={1}
                            value={port}
                            onChange={(event) => setPort(event.target.value)}
                            required
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-username`} label={t('terminals.form.username')} required>
                        <Input
                            id={`${id}-username`}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            maxLength={100}
                            autoComplete="off"
                            required
                        />
                    </Field>
                    <Field
                        htmlFor={`${id}-password`}
                        label={t('terminals.form.newPassword')}
                        hint={t('terminals.form.newPasswordHint')}
                    >
                        <Input
                            id={`${id}-password`}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="new-password"
                            maxLength={256}
                        />
                    </Field>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                    <div className="min-w-0">
                        <Label htmlFor={`${id}-active`} className="leading-5">{t('terminals.form.active')}</Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t('terminals.form.activeHint')}</p>
                    </div>
                    <Switch id={`${id}-active`} checked={isActive} onCheckedChange={setIsActive} />
                </div>
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? t('common.saving') : t('terminals.form.saveChanges')}
                </Button>
            </div>
        </form>
    );
}
