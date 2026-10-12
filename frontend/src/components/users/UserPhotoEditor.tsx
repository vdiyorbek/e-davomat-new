
import { useEffect, useId, useState } from 'react';
import { ImagePlus, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import {
    getUserPhoto,
    uploadUserPhoto,
} from '@/lib/user-photos-api';

interface Props {
    userId: number;
    photoUrl: string | null;
    onUploaded: (photoUrl: string) => Promise<void> | void;
}

const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function UserPhotoEditor({
    userId,
    photoUrl,
    onUploaded,
}: Props) {
    const inputId = useId();

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');

    const photoKey = `${userId}:${photoUrl ?? ''}`;
    const [remotePhoto, setRemotePhoto] = useState({
        key: '',
        url: '',
    });

    const [loadingPhoto, setLoadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // Serverdagi rasmni JWT bilan yuklaymiz.
    useEffect(() => {
        if (!photoUrl) {
            return;
        }

        const controller = new AbortController();
        let objectUrl = '';

        setLoadingPhoto(true);
        setPhotoError('');

        void getUserPhoto(userId, controller.signal)
            .then((blob) => {
                if (controller.signal.aborted) return;

                objectUrl = URL.createObjectURL(blob);

                setRemotePhoto({
                    key: photoKey,
                    url: objectUrl,
                });
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;

                setPhotoError(
                    err instanceof ApiError
                        ? err.message
                        : 'Rasmni yuklab bo‘lmadi.',
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingPhoto(false);
                }
            });

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [userId, photoUrl, photoKey]);

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

    const savedPhoto =
        remotePhoto.key === photoKey ? remotePhoto.url : '';

    const displayUrl = previewUrl || savedPhoto;

    function selectFile(selected: File | undefined) {
        setError('');
        setNotice('');

        if (!selected) return;

        if (!allowedTypes.includes(selected.type)) {
            setError('Faqat JPEG, PNG yoki WebP rasm tanlang.');
            return;
        }

        if (selected.size > MAX_FILE_SIZE) {
            setError('Rasm hajmi 5 MB dan oshmasligi kerak.');
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

            setNotice('Profil rasmi muvaffaqiyatli saqlandi.');
        } catch (err: unknown) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Rasmni yuklash yoki profilni yangilashda xatolik.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            <div
                className="flex size-28 items-center justify-center
          overflow-hidden rounded-2xl border bg-muted"
            >
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        alt="Foydalanuvchining profil rasmi"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <UserRound
                        aria-hidden="true"
                        className="size-12 text-muted-foreground"
                    />
                )}
            </div>

            {loadingPhoto && !file && (
                <p role="status" className="text-xs text-muted-foreground">
                    Rasm yuklanmoqda...
                </p>
            )}

            {photoError && !file && (
                <p role="status" className="text-xs text-destructive">
                    {photoError}
                </p>
            )}

            <div className="space-y-2">
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium"
                >
                    Profil rasmi
                </label>

                <input
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className="block w-full max-w-sm text-sm
            file:mr-3 file:rounded-lg file:border
            file:bg-background file:px-3 file:py-2"
                    onChange={(event) => {
                        selectFile(event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />

                <p className="text-xs text-muted-foreground">
                    JPEG, PNG yoki WebP. Maksimal 5 MB.
                </p>
            </div>

            {file && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleUpload()}
                    >
                        <ImagePlus className="mr-2 size-4" />
                        {busy ? 'Yuklanmoqda...' : 'Rasmni saqlash'}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setFile(null)}
                    >
                        Bekor qilish
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {notice && (
                <p role="status" className="text-sm text-green-600">
                    {notice}
                </p>
            )}
        </div>
    );
}
