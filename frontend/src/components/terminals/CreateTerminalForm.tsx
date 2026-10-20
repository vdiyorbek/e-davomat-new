import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useApiQuery } from '@/hooks/useApiQuery';
import { createTerminal } from '@/lib/terminals-api';
import type { School } from '@/types/school';
import type { TerminalDirection, TerminalProtocol } from '@/types/terminal';

interface CreateTerminalFormProps {
    onSaved: () => void;
    onCancel: () => void;
}

export function CreateTerminalForm({ onSaved, onCancel }: CreateTerminalFormProps) {
    const { t } = useTranslation();
    const formId = useId();
    const busyRef = useRef(false);

    const [name, setName] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [direction, setDirection] = useState<TerminalDirection>('IN');
    const [host, setHost] = useState('');
    const [protocol, setProtocol] = useState<TerminalProtocol>('HTTP');
    const [port, setPort] = useState('80');
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const { data: schools, loading, error: schoolsError, retry } = useApiQuery<School[]>('/schools');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busyRef.current) return;
        setError('');

        const portNumber = Number(port);
        const school = schools?.find((item) => String(item.id) === schoolId);

        if (!school) return setError(t('members.errors.chooseSchool'));
        if (name.trim().length < 2 || !host.trim() || !username.trim() || !password) return setError(t('terminals.form.errors.required'));
        if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return setError(t('terminals.form.errors.port'));

        busyRef.current = true;
        setBusy(true);
        try {
            await createTerminal({
                name: name.trim(),
                schoolId: school.id,
                direction,
                protocol,
                host: host.trim(),
                port: portNumber,
                username: username.trim(),
                password,
                isActive,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('terminals.form.errors.saveFailed'));
            return;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${formId}-name`} label={t('terminals.form.name')} required>
                        <Input
                            id={`${formId}-name`}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t('terminals.form.namePlaceholder')}
                            required
                            minLength={2}
                            maxLength={150}
                        />
                    </Field>
                    <Field htmlFor={`${formId}-direction`} label={t('terminals.direction')} required>
                        <SelectField
                            id={`${formId}-direction`}
                            value={direction}
                            onValueChange={(value) => setDirection(value === 'OUT' ? 'OUT' : 'IN')}
                            options={[
                                { value: 'IN', label: t('terminals.directions.IN') },
                                { value: 'OUT', label: t('terminals.directions.OUT') },
                            ]}
                        />
                    </Field>
                    <Field
                        htmlFor={`${formId}-school`}
                        label={t('common.school')}
                        required
                        className="sm:col-span-2"
                        error={schoolsError || undefined}
                        hint={!loading && !schoolsError && schools?.length === 0 ? t('members.create.noSchools') : undefined}
                    >
                        <SelectField
                            id={`${formId}-school`}
                            value={schoolId}
                            onValueChange={setSchoolId}
                            required
                            searchable
                            disabled={loading || Boolean(schoolsError)}
                            placeholder={loading ? t('common.loading') : t('members.chooseSchool')}
                            options={(schools ?? []).map((school) => ({
                                value: String(school.id),
                                label: `${school.district.region.name} / ${school.district.name} / ${school.name}`,
                            }))}
                        />
                        {schoolsError && (
                            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={retry}>
                                {t('common.retry')}
                            </Button>
                        )}
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <Field htmlFor={`${formId}-host`} label={t('terminals.form.host')} hint={t('terminals.form.hostHint')} required>
                        <Input
                            id={`${formId}-host`}
                            value={host}
                            onChange={(event) => setHost(event.target.value)}
                            placeholder="192.168.1.100"
                            required
                            maxLength={253}
                            autoComplete="off"
                            inputMode="url"
                            className="font-mono"
                        />
                    </Field>
                    <Field htmlFor={`${formId}-protocol`} label={t('terminals.form.protocol')}>
                        <SelectField
                            id={`${formId}-protocol`}
                            value={protocol}
                            onValueChange={(value) => {
                                const next = value === 'HTTPS' ? 'HTTPS' : 'HTTP';
                                setProtocol(next);
                                setPort(next === 'HTTPS' ? '443' : '80');
                            }}
                            options={[
                                { value: 'HTTP', label: 'HTTP' },
                                { value: 'HTTPS', label: 'HTTPS' },
                            ]}
                        />
                    </Field>
                    <Field htmlFor={`${formId}-port`} label={t('terminals.form.port')} required>
                        <Input
                            id={`${formId}-port`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={65535}
                            step={1}
                            required
                            value={port}
                            onChange={(event) => setPort(event.target.value)}
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${formId}-username`} label={t('terminals.form.username')} required>
                        <Input
                            id={`${formId}-username`}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            required
                            maxLength={100}
                            autoComplete="off"
                        />
                    </Field>
                    <Field htmlFor={`${formId}-password`} label={t('terminals.form.password')} required>
                        <Input
                            id={`${formId}-password`}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            maxLength={256}
                            autoComplete="new-password"
                        />
                    </Field>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                    <Label htmlFor={`${formId}-active`} className="leading-5">
                        {t('terminals.form.active')}
                    </Label>
                    <Switch id={`${formId}-active`} checked={isActive} onCheckedChange={setIsActive} />
                </div>
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy || loading || Boolean(schoolsError) || !schools?.length}>
                    {busy ? t('common.saving') : t('terminals.form.save')}
                </Button>
            </div>
        </form>
    );
}
