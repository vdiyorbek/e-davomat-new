import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { uploadPersonPhoto } from '@/lib/person-photos-api';

interface ChangePersonPhotoProps {
    personId: number;
    photoUrl: string | null;
    name: string;
    onSaved: () => void;
    onCancel: () => void;
}

export function ChangePersonPhoto({
    personId,
    photoUrl,
    name,
    onSaved,
    onCancel,
}: ChangePersonPhotoProps) {
    const inputId = useId();
    const savingRef = useRef(false);

    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    function handleSelect(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0];

        // Xuddi shu faylni qayta tanlash imkonini beradi.
        event.target.value = '';

        if (!selected) return;

        setError('');
        setFile(null);

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
        ];

        if (!allowedTypes.includes(selected.type)) {
            setError('JPG, PNG yoki WebP formatidagi rasmni tanlang.');
            return;
        }

        if (selected.size === 0) {
            setError('Tanlangan fayl bo‘sh.');
            return;
        }

        if (selected.size > 5 * 1024 * 1024) {
            setError('Rasm hajmi 5 MB dan oshmasligi kerak.');
            return;
        }

        setFile(selected);
    }

    async function handleSave() {
        if (!file || savingRef.current) return;

        savingRef.current = true;
        setBusy(true);
        setError('');

        try {
            await uploadPersonPhoto(personId, file);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Rasmni yuklab bo‘lmadi.',
            );
            return;
        } finally {
            savingRef.current = false;
            setBusy(false);
        }

        onSaved();
    }

    return (
        <section
            aria-label="Profil rasmini almashtirish"
            className="space-y-5 rounded-xl border p-4 sm:p-5"
        >
            <div>
                <h3 className="font-semibold">
                    Profil rasmini almashtirish
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                    Yuz aniq ko‘rinadigan JPG, PNG yoki WebP rasm.
                    Maksimal hajm — 5 MB.
                </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0">
                    <PersonPhoto
                        personId={personId}
                        photoUrl={photoUrl}
                        file={file}
                        name={name}
                    />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium"
                    >
                        Yangi rasm
                    </label>

                    <input
                        id={inputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={handleSelect}
                        className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground disabled:opacity-50"
                    />

                    {file && (
                        <p className="break-all text-xs text-muted-foreground">
                            Tanlandi: {file.name}
                        </p>
                    )}
                </div>
            </div>

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
                    type="button"
                    disabled={busy || !file}
                    onClick={handleSave}
                >
                    {busy ? 'Yuklanmoqda…' : 'Rasmni saqlash'}
                </Button>
            </div>
        </section>
    );
}