
import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FileInput } from '@/components/common/FileInput';
import { ErrorState } from '@/components/common/states';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { Button } from '@/components/ui/button';
import { validateFacePhoto } from '@/lib/face-photo-validation';
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
    const { t } = useTranslation();

    const savingRef = useRef(false);
    const selectionId = useRef(0);

    const [file, setFile] = useState<File | null>(null);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const busy = checking || saving;

    async function handleSelect(selected: File | null) {
        const currentSelection = ++selectionId.current;

        setError('');
        setFile(null);

        if (!selected) {
            setChecking(false);
            return;
        }

        setChecking(true);

        try {
            const result = await validateFacePhoto(selected);

            if (currentSelection !== selectionId.current) return;

            if (!result.valid) {
                setError(
                    result.error ?? 'Rasm talabga javob bermaydi.',
                );
                return;
            }

            setFile(selected);
        } catch {
            if (currentSelection === selectionId.current) {
                setError('Rasmni tekshirib bo‘lmadi.');
            }
        } finally {
            if (currentSelection === selectionId.current) {
                setChecking(false);
            }
        }
    }

    async function handleSave() {
        if (!file || busy || savingRef.current) return;

        savingRef.current = true;
        setSaving(true);
        setError('');

        try {
            await uploadPersonPhoto(personId, file);
            onSaved();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('photo.uploadFailed'),
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">

            {/* Rasm va fayl tanlash */}
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">

                <div className="flex justify-center sm:justify-start">
                    <PersonPhoto
                        personId={personId}
                        photoUrl={photoUrl}
                        file={file}
                        name={name}
                        className="size-28 shrink-0"
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <FileInput
                        className="w-full max-w-full"
                        accept="image/jpeg,image/png,image/webp"
                        file={file}
                        onFileChange={(selected) => {
                            void handleSelect(selected);
                        }}
                        disabled={busy}
                        icon={<ImageUp aria-hidden="true" />}
                        buttonLabel={t('photo.choose')}
                    />

                    <p className="text-xs leading-5 text-muted-foreground">
                        Yuz aniq ko‘rinadigan JPG, PNG yoki WebP rasm.
                        Maksimal hajm — 5 MB.
                        Minimal o‘lcham — 640×480 piksel.
                    </p>
                </div>
            </div>

            {/* Xatolik */}
            {error && (
                <div className="min-w-0">
                    <ErrorState message={error} />
                </div>
            )}

            {/* Tugmalar alohida pastki qatorda */}
            <div className="flex w-full min-w-0 flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                    className="w-full sm:w-auto"
                >
                    {t('common.cancel')}
                </Button>

                <Button
                    type="button"
                    disabled={busy || !file}
                    onClick={() => void handleSave()}
                    className="w-full sm:w-auto"
                >
                    {saving
                        ? t('common.saving')
                        : checking
                            ? 'Tekshirilmoqda...'
                            : t('photo.save')}
                </Button>
            </div>
        </div>
    );
}
