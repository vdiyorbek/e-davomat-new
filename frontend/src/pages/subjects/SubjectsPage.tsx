
import { useState } from 'react';
import type { FormEvent } from 'react';
import { BookMarked, Plus, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';

interface Subject {
    id: number;
    code: string;
    nameUz: string;
    nameRu: string | null;
    isActive: boolean;
}

export function SubjectsPage() {
    const query = useApiQuery<Subject[]>('/subjects');

    const [code, setCode] = useState('');
    const [nameUz, setNameUz] = useState('');
    const [nameRu, setNameRu] = useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const subjects = query.data ?? [];

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        setError('');
        setSuccess('');

        const cleanCode = code.trim().toUpperCase();
        const cleanNameUz = nameUz.trim();
        const cleanNameRu = nameRu.trim();

        if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(cleanCode)) {
            setError(
                'Fan kodi 2–40 belgidan iborat bo‘lsin. Lotin harflari, raqamlar va _ ishlating.',
            );
            return;
        }

        if (cleanNameUz.length < 2) {
            setError('Fan nomini kiriting.');
            return;
        }

        setBusy(true);

        try {
            await authorizedPost<Subject>('/subjects', {
                code: cleanCode,
                nameUz: cleanNameUz,
                ...(cleanNameRu ? { nameRu: cleanNameRu } : {}),
            });

            setSuccess(`"${cleanNameUz}" fani muvaffaqiyatli qo‘shildi.`);

            setCode('');
            setNameUz('');
            setNameRu('');

            query.retry();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Fanni qo‘shishda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Elektron ta’lim"
                title="Fanlar"
                description="O‘quv fanlarini yaratish va mavjud fanlar ro‘yxatini boshqarish."
                actions={<BookMarked className="size-7 text-primary" />}
            />

            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div>
                    <h2 className="text-lg font-semibold">
                        Yangi fan qo‘shish
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Yaratilgan fan darsliklar va o‘qituvchi biriktirish
                        sahifalarida foydalaniladi.
                    </p>
                </div>

                <form
                    onSubmit={(event) => void handleCreate(event)}
                    className="space-y-4"
                >
                    <div className="grid gap-4 md:grid-cols-3">
                        <label className="text-sm font-medium">
                            Fan kodi
                            <Input
                                className="mt-2"
                                value={code}
                                onChange={(event) =>
                                    setCode(event.target.value.toUpperCase())
                                }
                                placeholder="MATEMATIKA"
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
                                onChange={(event) => setNameUz(event.target.value)}
                                placeholder="Matematika"
                                maxLength={150}
                                disabled={busy}
                                required
                            />
                        </label>

                        <label className="text-sm font-medium">
                            Fan nomi (ruscha, ixtiyoriy)
                            <Input
                                className="mt-2"
                                value={nameRu}
                                onChange={(event) => setNameRu(event.target.value)}
                                placeholder="Математика"
                                maxLength={150}
                                disabled={busy}
                            />
                        </label>
                    </div>

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p role="status" className="text-sm text-green-600">
                            {success}
                        </p>
                    )}

                    <Button type="submit" disabled={busy}>
                        <Plus className="size-4" />
                        {busy ? 'Saqlanmoqda…' : 'Fan qo‘shish'}
                    </Button>
                </form>
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Mavjud fanlar
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Jami: {subjects.length}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={query.retry}
                        disabled={query.loading}
                    >
                        <RefreshCw className="size-4" />
                        Yangilash
                    </Button>
                </div>

                {query.loading ? (
                    <p className="text-sm text-muted-foreground">
                        Fanlar yuklanmoqda…
                    </p>
                ) : query.error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {query.error}
                    </p>
                ) : subjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Hozircha fanlar mavjud emas. Yuqoridagi forma orqali
                        birinchi fanni qo‘shing.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">№</th>
                                    <th className="px-4 py-3">Fan kodi</th>
                                    <th className="px-4 py-3">O‘zbekcha nomi</th>
                                    <th className="px-4 py-3">Ruscha nomi</th>
                                    <th className="px-4 py-3">Holati</th>
                                </tr>
                            </thead>

                            <tbody>
                                {subjects.map((subject, index) => (
                                    <tr
                                        key={subject.id}
                                        className="border-t border-border"
                                    >
                                        <td className="px-4 py-3 tabular-nums">
                                            {index + 1}
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
                                                {subject.isActive ? 'Faol' : 'Faol emas'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
