import { useEffect, useId, useState } from 'react';
import { Camera, ImagePlus, Loader2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUserPhoto } from '@/hooks/useUserPhoto';
import { ApiError } from '@/lib/api';
import { uploadUserPhoto } from '@/lib/user-photos-api';

interface Props {
    userId: number;
    photoUrl: string | null;
    onUploaded: (photoUrl: string) => Promise<void> | void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function UserPhotoEditor({ userId, photoUrl, onUploaded }: Props) {
    const { t } = useTranslation();
    const inputId = useId();

    const savedPhoto = useUserPhoto(userId, photoUrl);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // Tanlangan faylni yuklashdan oldin ko‘rsatamiz.
    useEffect(() => {
        if (!file) {
            setPreviewUrl('');
            return;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const displayUrl = previewUrl || savedPhoto;

    function selectFile(selected: File | undefined) {
        setError('');
        setNotice('');
        if (!selected) return;

        if (!ALLOWED_TYPES.includes(selected.type)) {
            setError(t('photo.wrongType'));
            return;
        }
        if (selected.size > MAX_FILE_SIZE) {
            setError(t('photo.tooLarge', { size: 5 }));
            return;
        }
        setFile(selected);
    }

    async function handleUpload() {
        if (!file || busy) return;
        setBusy(true);
        setError('');
        setNotice('');

        try {
            const result = await uploadUserPhoto(userId, file);
            setFile(null);
            await onUploaded(result.photoUrl);
            setNotice(t('photo.saved'));
        } catch (err: unknown) {
            setError(err instanceof ApiError ? err.message : t('photo.uploadFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex w-full flex-col items-center gap-4">
            <div className="relative">
                <div className="flex size-32 items-center justify-center overflow-hidden rounded-3xl border bg-muted shadow-inner">
                    {displayUrl ? (
                        <img src={displayUrl} alt={t('photo.alt')} className="h-full w-full object-cover" />
                    ) : (
                        <UserRound aria-hidden="true" className="size-14 text-muted-foreground" />
                    )}
                </div>
                <Button
                    asChild
                    size="icon"
                    className="absolute -right-2 -bottom-2 rounded-full border-4 border-card"
                >
                    <label htmlFor={inputId} className="cursor-pointer" aria-label={t('photo.choose')}>
                        <Camera aria-hidden="true" />
                    </label>
                </Button>
                <input
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className="sr-only"
                    onChange={(event) => {
                        selectFile(event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />
            </div>

            <p className="text-xs text-muted-foreground">{t('photo.hint', { size: 5 })}</p>

            {file && (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" disabled={busy} onClick={() => void handleUpload()}>
                        {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ImagePlus aria-hidden="true" />}
                        {busy ? t('common.saving') : t('photo.save')}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setFile(null)}>
                        {t('common.cancel')}
                    </Button>
                </div>
            )}

            {error && (
                <Alert variant="destructive" className="text-left">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {notice && (
                <Alert variant="success" className="text-left">
                    <AlertDescription>{notice}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
