import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

import { ApiError } from '@/lib/api';
import { getPersonPhoto } from '@/lib/person-photos-api';

interface PersonPhotoProps {
    personId?: number;
    photoUrl?: string | null;
    file?: File | null;
    name?: string;
}

interface PhotoState {
    key: string;
    file: File | null;
    url: string;
    error: string;
}

export function PersonPhoto({
    personId,
    photoUrl,
    file = null,
    name = 'Profil',
}: PersonPhotoProps) {
    const key = `${personId ?? ''}:${photoUrl ?? ''}`;

    const [state, setState] = useState<PhotoState>({
        key: '',
        file: null,
        url: '',
        error: '',
    });

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';

        async function load() {
            try {
                let blob: Blob;

                if (file) {
                    blob = file;
                } else if (personId && photoUrl) {
                    blob = await getPersonPhoto(
                        personId,
                        controller.signal,
                    );
                } else {
                    return;
                }

                if (controller.signal.aborted) return;

                objectUrl = URL.createObjectURL(blob);

                setState({
                    key,
                    file,
                    url: objectUrl,
                    error: '',
                });
            } catch (error: unknown) {
                if (controller.signal.aborted) return;

                setState({
                    key,
                    file,
                    url: '',
                    error:
                        error instanceof ApiError &&
                            error.status === 404
                            ? 'Rasm mavjud emas.'
                            : 'Rasmni yuklab bo‘lmadi.',
                });
            }
        }

        void load();

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [personId, photoUrl, file, key]);

    const matches = state.key === key && state.file === file;
    const url = matches ? state.url : '';
    const error = matches ? state.error : '';
    const hasSource = Boolean(file || (personId && photoUrl));

    return (
        <div className="space-y-2">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-blue-50 shadow-sm dark:bg-slate-800">
                {url && !error ? (
                    <img
                        src={url}
                        alt={`${name} — profil rasmi`}
                        className="h-full w-full object-cover"
                        onError={() => {
                            setState((current) =>
                                current.url === url
                                    ? {
                                        ...current,
                                        error: 'Rasmni ko‘rsatib bo‘lmadi.',
                                    }
                                    : current,
                            );
                        }}
                    />
                ) : (
                    <UserRound
                        aria-hidden="true"
                        className="size-10 text-blue-600 dark:text-blue-300"
                    />
                )}
            </div>

            {hasSource && !url && !error && (
                <p role="status" className="text-xs text-muted-foreground">
                    Rasm yuklanmoqda…
                </p>
            )}

            {error && (
                <p role="status" className="text-xs text-muted-foreground">
                    {error}
                </p>
            )}
        </div>
    );
}