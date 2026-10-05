import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { createTerminal } from '@/lib/terminals-api';

import type { School } from '@/types/school';
import type { TerminalProtocol } from '@/types/terminal';

interface CreateTerminalFormProps {
    onSaved: () => void;
    onCancel: () => void;
}

export function CreateTerminalForm({
    onSaved,
    onCancel,
}: CreateTerminalFormProps) {
    const formId = useId();
    const busyRef = useRef(false);

    const [protocol, setProtocol] =
        useState<TerminalProtocol>('HTTP');
    const [port, setPort] = useState('80');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const {
        data: schools,
        loading,
        error: schoolsError,
        retry,
    } = useApiQuery<School[]>('/schools');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busyRef.current) return;

        setError('');

        const form = new FormData(event.currentTarget);

        const name = String(form.get('name') ?? '').trim();
        const schoolId = Number(form.get('schoolId'));
        const direction = form.get('direction');
        const host = String(form.get('host') ?? '').trim();
        const username = String(form.get('username') ?? '').trim();
        const password = String(form.get('password') ?? '');
        const portNumber = Number(port);

        if (!schools?.some((school) => school.id === schoolId)) {
            setError('Ro‘yxatdan maktabni tanlang.');
            return;
        }

        if (direction !== 'IN' && direction !== 'OUT') {
            setError('Terminal yo‘nalishini tanlang.');
            return;
        }

        if (name.length < 2 || !host || !username || !password) {
            setError('Majburiy maydonlarni to‘ldiring.');
            return;
        }

        if (
            !Number.isInteger(portNumber) ||
            portNumber < 1 ||
            portNumber > 65535
        ) {
            setError('Port 1 dan 65535 gacha butun son bo‘lishi kerak.');
            return;
        }

        busyRef.current = true;
        setBusy(true);

        try {
            await createTerminal({
                name,
                schoolId,
                direction,
                protocol,
                host,
                port: portNumber,
                username,
                password,
                isActive: form.get('isActive') === 'on',
            });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Terminalni saqlab bo‘lmadi.',
            );
            return;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }

        onSaved();
    }

    const selectClass =
        'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border bg-card p-4 text-card-foreground sm:p-6"
        >
            <h2 className="text-lg font-semibold">
                Yangi terminal
            </h2>

            <fieldset disabled={busy} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-name`}
                            className="text-sm font-medium"
                        >
                            Terminal nomi
                        </label>

                        <Input
                            id={`${formId}-name`}
                            name="name"
                            placeholder="Asosiy kirish terminali"
                            required
                            minLength={2}
                            maxLength={150}
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-school`}
                            className="text-sm font-medium"
                        >
                            Maktab
                        </label>

                        <select
                            id={`${formId}-school`}
                            name="schoolId"
                            required
                            defaultValue=""
                            disabled={loading || Boolean(schoolsError)}
                            className={selectClass}
                        >
                            <option value="">
                                {loading ? 'Yuklanmoqda…' : 'Maktabni tanlang'}
                            </option>

                            {schools?.map((school) => (
                                <option key={school.id} value={school.id}>
                                    {school.district.region.name}
                                    {' / '}
                                    {school.district.name}
                                    {' / '}
                                    {school.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-direction`}
                            className="text-sm font-medium"
                        >
                            Yo‘nalish
                        </label>

                        <select
                            id={`${formId}-direction`}
                            name="direction"
                            defaultValue="IN"
                            className={selectClass}
                        >
                            <option value="IN">Kirish</option>
                            <option value="OUT">Chiqish</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-host`}
                            className="text-sm font-medium"
                        >
                            IP manzili
                        </label>

                        <Input
                            id={`${formId}-host`}
                            name="host"
                            placeholder="192.168.1.100"
                            required
                            maxLength={253}
                            autoComplete="off"
                        />

                        <p className="text-xs text-muted-foreground">
                            http:// va portsiz, faqat IP manzil.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-protocol`}
                            className="text-sm font-medium"
                        >
                            Protokol
                        </label>

                        <select
                            id={`${formId}-protocol`}
                            value={protocol}
                            onChange={(event) => {
                                const value =
                                    event.target.value === 'HTTPS'
                                        ? 'HTTPS'
                                        : 'HTTP';

                                setProtocol(value);
                                setPort(value === 'HTTPS' ? '443' : '80');
                            }}
                            className={selectClass}
                        >
                            <option value="HTTP">HTTP</option>
                            <option value="HTTPS">HTTPS</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-port`}
                            className="text-sm font-medium"
                        >
                            Port
                        </label>

                        <Input
                            id={`${formId}-port`}
                            type="number"
                            min={1}
                            max={65535}
                            step={1}
                            required
                            value={port}
                            onChange={(event) => setPort(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-username`}
                            className="text-sm font-medium"
                        >
                            Terminal logini
                        </label>

                        <Input
                            id={`${formId}-username`}
                            name="username"
                            defaultValue="admin"
                            required
                            maxLength={100}
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-password`}
                            className="text-sm font-medium"
                        >
                            Terminal paroli
                        </label>

                        <Input
                            id={`${formId}-password`}
                            name="password"
                            type="password"
                            required
                            maxLength={256}
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                <label className="flex items-center gap-3 text-sm">
                    <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked
                        className="h-4 w-4"
                    />
                    Terminal faol
                </label>
            </fieldset>

            {schoolsError && (
                <div className="space-y-2">
                    <p role="alert" className="text-sm text-destructive">
                        {schoolsError}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={retry}
                        disabled={busy}
                    >
                        Maktablarni qayta yuklash
                    </Button>
                </div>
            )}

            {!loading && !schoolsError && schools?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Avval maktab yarating.
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                >
                    Bekor qilish
                </Button>

                <Button
                    type="submit"
                    disabled={
                        busy ||
                        loading ||
                        Boolean(schoolsError) ||
                        !schools?.length
                    }
                >
                    {busy ? 'Saqlanmoqda…' : 'Terminalni saqlash'}
                </Button>
            </div>
        </form>
    );
}