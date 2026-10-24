import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FileInput } from '@/components/common/FileInput';
import { validateFacePhoto } from '@/lib/face-photo-validation';
import { ErrorState } from '@/components/common/states';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { Button } from '@/components/ui/button';
import { uploadPersonPhoto } from '@/lib/person-photos-api';

interface ChangePersonPhotoProps {
    personId: number;
    photoUrl: string | null;
    name: string;
    onSaved: () => void;
    onCancel: () => void;
}

export function ChangePersonPhoto({ personId, photoUrl, name, onSaved, onCancel }: ChangePersonPhotoProps) {
    const { t } = useTranslation();
    const savingRef = useRef(false);

    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');


    const selectionId = useRef(0);

    async function handleSelect(selected: File | null) {
        const currentSelection = ++selectionId.current;

        setError('');
        setFile(null);

        if (!selected) return;

        setBusy(true);

        try {
            const result = await validateFacePhoto(selected);

            if (currentSelection !== selectionId.current) return;

            if (!result.valid) {
                setError(result.error ?? 'Rasm talabga javob bermaydi.');
                return;
            }

            setFile(selected);
        } finally {
            if (currentSelection === selectionId.current) {
                setBusy(false);
            }
        }
    }


    async function handleSave() {
        if (!file || savingRef.current) return;
        savingRef.current = true;
        setBusy(true);
        setError('');
        try {
            await uploadPersonPhoto(personId, file);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('photo.uploadFailed'));
            return;
        } finally {
            savingRef.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <PersonPhoto personId={personId} photoUrl={photoUrl} file={file} name={name} className="shrink-0" />
                <div className="w-full min-w-0 flex-1 space-y-2">
                    <FileInput
                        className="w-full max-w-full"
                        accept="image/jpeg,image/png,image/webp"
                        file={file}
                        onFileChange={handleSelect}
                        disabled={busy}
                        icon={<ImageUp aria-hidden="true" />}
                        buttonLabel={t('photo.choose')}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">{t('persons.photoHint', { size: 5 })}</p>
                </div>
            </div>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="button" disabled={busy || !file} onClick={() => void handleSave()}>
                    {busy ? t('common.saving') : t('photo.save')}
                </Button>
            </div>
        </div>
    );
}
