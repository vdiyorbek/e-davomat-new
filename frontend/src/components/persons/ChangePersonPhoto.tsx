import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FileInput } from '@/components/common/FileInput';
import { validateImage } from '@/lib/files';
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

    function handleSelect(selected: File | null) {
        setError('');
        setFile(null);
        if (!selected) return;
        const invalid = validateImage(selected);
        if (invalid) {
            setError(t(invalid, { size: 5 }));
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
            setError(err instanceof Error ? err.message : t('photo.uploadFailed'));
            return;
        } finally {
            savingRef.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <PersonPhoto personId={personId} photoUrl={photoUrl} file={file} name={name} />
                <div className="w-full min-w-0 flex-1 space-y-2">
                    <FileInput
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
