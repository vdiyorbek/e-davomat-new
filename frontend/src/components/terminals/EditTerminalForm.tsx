
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Field } from "@/components/common/Field";
import { SelectField } from "@/components/common/SelectField";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { updateTerminal } from "@/lib/terminals-api";

import type {
    Terminal,
    TerminalDirection,
    TerminalProtocol,
} from "@/types/terminal";

interface Props {
    terminal: Terminal;
    onSaved: () => void;
    onCancel: () => void;
}

export function EditTerminalForm({
    terminal,
    onSaved,
    onCancel,
}: Props) {
    const id = useId();

    const [name, setName] = useState(terminal.name);
    const [direction, setDirection] =
        useState<TerminalDirection>(terminal.direction);
    const [protocol, setProtocol] =
        useState<TerminalProtocol>(terminal.protocol);
    const [host, setHost] = useState(terminal.host);
    const [port, setPort] = useState(String(terminal.port));
    const [username, setUsername] = useState(terminal.username);
    const [password, setPassword] = useState("");
    const [isActive, setIsActive] = useState(terminal.isActive);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const portNumber = Number(port);

        if (
            name.trim().length < 2 ||
            !host.trim() ||
            !username.trim()
        ) {
            setError("Majburiy maydonlarni to‘ldiring.");
            return;
        }

        if (
            !Number.isInteger(portNumber) ||
            portNumber < 1 ||
            portNumber > 65535
        ) {
            setError("Port 1 dan 65535 gacha bo‘lishi kerak.");
            return;
        }

        setSaving(true);
        setError("");

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
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Terminalni yangilashda xatolik yuz berdi.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{terminal.school.name}</p>
                <p className="mt-1 text-muted-foreground">
                    {terminal.school.region.name} /{" "}
                    {terminal.school.district.name}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                    Terminal ID: #{terminal.id}
                </p>
            </div>

            <fieldset disabled={saving} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-name`} label="Terminal nomi" required>
                        <Input
                            id={`${id}-name`}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            minLength={2}
                            maxLength={150}
                            required
                        />
                    </Field>

                    <Field htmlFor={`${id}-direction`} label="Yo‘nalish">
                        <SelectField
                            id={`${id}-direction`}
                            value={direction}
                            onValueChange={(value) =>
                                setDirection(value === "OUT" ? "OUT" : "IN")
                            }
                            options={[
                                { value: "IN", label: "Kirish" },
                                { value: "OUT", label: "Chiqish" },
                            ]}
                        />
                    </Field>

                    <Field htmlFor={`${id}-host`} label="IP manzil" required>
                        <Input
                            id={`${id}-host`}
                            value={host}
                            onChange={(event) => setHost(event.target.value)}
                            placeholder="192.168.1.100"
                            autoComplete="off"
                            maxLength={253}
                            required
                        />
                    </Field>

                    <Field htmlFor={`${id}-protocol`} label="Protokol">
                        <SelectField
                            id={`${id}-protocol`}
                            value={protocol}
                            onValueChange={(value) =>
                                setProtocol(value === "HTTPS" ? "HTTPS" : "HTTP")
                            }
                            options={[
                                { value: "HTTP", label: "HTTP" },
                                { value: "HTTPS", label: "HTTPS" },
                            ]}
                        />
                    </Field>

                    <Field htmlFor={`${id}-port`} label="Port" required>
                        <Input
                            id={`${id}-port`}
                            type="number"
                            min={1}
                            max={65535}
                            step={1}
                            value={port}
                            onChange={(event) => setPort(event.target.value)}
                            required
                        />
                    </Field>

                    <Field htmlFor={`${id}-username`} label="Login" required>
                        <Input
                            id={`${id}-username`}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            maxLength={100}
                            autoComplete="off"
                            required
                        />
                    </Field>

                    <div className="sm:col-span-2">
                        <Field
                            htmlFor={`${id}-password`}
                            label="Yangi parol"
                            hint="O‘zgartirmaslik uchun bo‘sh qoldiring."
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
                </div>

                <div className="flex items-center justify-between rounded-xl border p-4">
                    <Label htmlFor={`${id}-active`}>
                        Terminal faol
                    </Label>
                    <Switch
                        id={`${id}-active`}
                        checked={isActive}
                        onCheckedChange={setIsActive}
                    />
                </div>
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Bekor qilish
                </Button>

                <Button type="submit" disabled={saving}>
                    {saving ? "Saqlanmoqda..." : "O‘zgarishlarni saqlash"}
                </Button>
            </div>
        </form>
    );
}
