
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    Archive,
    Check,
    Pencil,
    RotateCcw,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPatch } from '@/lib/auth-session';

interface Subject {
    id: number;
    code: string;
    nameUz: string;
    nameRu: string | null;
    isActive: boolean;
}

interface Props {
    subject: Subject;
    index: number;
    onUpdated: () => void;
}

export function SubjectRow({
    subject,
    index,
    onUpdated,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [code, setCode] = useState(subject.code);
    const [nameUz, setNameUz] = useState(subject.nameUz);
    const [nameRu, setNameRu] = useState(subject.nameRu ?? '');

    function startEditing() {
        setCode(subject.code);
        setNameUz(subject.nameUz);
        setNameRu(subject.nameRu ?? '');
        setError('');
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setError('');
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        setError('');

        const cleanCode = code.trim().toUpperCase();
        const cleanNameUz = nameUz.trim();
        const cleanNameRu = nameRu.trim();

        if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(cleanCode)) {
            setError('Fan kodi noto‘g‘ri formatda.');
            return;
        }

        if (
            cleanNameUz.length < 2 ||
            cleanNameUz.length > 150 ||
            cleanNameRu.length > 150 ||
            (cleanNameRu.length > 0 && cleanNameRu.length < 2)
        ) {
            setError('Fan nomlari 2–150 belgidan iborat bo‘lishi kerak.');
            return;
        }

        setBusy(true);

        try {
            await authorizedPatch<Subject>(
                `/subjects/${subject.id}`,
                {
                    code: cleanCode,
                    nameUz: cleanNameUz,
                    nameRu: cleanNameRu || null,
                },
            );

            setEditing(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Fanni tahrirlab bo‘lmadi.',
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleToggleActive() {
        if (busy || editing) return;

        if (subject.isActive) {
            const confirmed = window.confirm(
                `"${subject.nameUz}" fanini arxivlaysizmi? ` +
                'Fan bazada saqlanadi, ammo yangi darslikka tanlab bo‘lmaydi.',
            );

            if (!confirmed) return;
        }

        setBusy(true);
        setError('');

        try {
            await authorizedPatch<Subject>(
                `/subjects/${subject.id}`,
                { isActive: !subject.isActive },
            );

            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Fan holatini o‘zgartirib bo‘lmadi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <tr className="border-t border-border">
                <td className="px-4 py-3 tabular-nums">
                    {index}
                </td>

                <td className="px-4 py-3 font-medium">
                    {subject.code}
                </td>

                <td className="px-4 py-3">
                    {subject.nameUz}
                </td>

                <td className="px-4 py-3">
                    {subject.nameRu ?? '—'}
                </td>

                <td className="px-4 py-3">
                    <span
                        className={
                            subject.isActive
                                ? 'font-medium text-green-600'
                                : 'text-muted-foreground'
                        }
                    >
                        {subject.isActive ? 'Faol' : 'Arxivlangan'}
                    </span>
                </td>

                <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={
                                editing ? cancelEditing : startEditing
                            }
                        >
                            <Pencil className="size-4" />
                            {editing ? 'Bekor qilish' : 'Tahrirlash'}
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            variant={
                                subject.isActive ? 'destructive' : 'secondary'
                            }
                            disabled={busy || editing}
                            onClick={() => void handleToggleActive()}
                        >
                            {subject.isActive ? (
                                <Archive className="size-4" />
                            ) : (
                                <RotateCcw className="size-4" />
                            )}

                            {subject.isActive ? 'Arxivlash' : 'Tiklash'}
                        </Button>
                    </div>

                    {!editing && error && (
                        <p
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                </td>
            </tr>

            {editing && (
                <tr className="border-t border-border bg-muted/30">
                    <td colSpan={6} className="p-4">
                        <form
                            onSubmit={(event) => void handleSave(event)}
                            className="space-y-4"
                        >
                            <h3 className="font-semibold">
                                {subject.nameUz} — tahrirlash
                            </h3>

                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="text-sm font-medium">
                                    Fan kodi
                                    <Input
                                        className="mt-2"
                                        value={code}
                                        onChange={(event) =>
                                            setCode(event.target.value.toUpperCase())
                                        }
                                        maxLength={40}
                                        disabled={busy}
                                        required
                                    />
                                </label>

                                <label className="text-sm font-medium">
                                    Fan nomi (o‘zbekcha)
                                    <Input
                                        className="mt-2"
                                        value={nameUz}
                                        onChange={(event) =>
                                            setNameUz(event.target.value)
                                        }
                                        maxLength={150}
                                        minLength={2}
                                        disabled={busy}
                                        required
                                    />
                                </label>

                                <label className="text-sm font-medium">
                                    Fan nomi (ruscha)
                                    <Input
                                        className="mt-2"
                                        value={nameRu}
                                        onChange={(event) =>
                                            setNameRu(event.target.value)
                                        }
                                        maxLength={150}
                                        disabled={busy}
                                    />
                                </label>
                            </div>

                            {error && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {error}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" disabled={busy}>
                                    <Check className="size-4" />
                                    {busy ? 'Saqlanmoqda…' : 'Saqlash'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={busy}
                                >
                                    <X className="size-4" />
                                    Bekor qilish
                                </Button>
                            </div>
                        </form>
                    </td>
                </tr>
            )}
        </>
    );
}
