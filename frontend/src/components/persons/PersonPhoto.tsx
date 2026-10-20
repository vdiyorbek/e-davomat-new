import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/lib/api';
import { getPersonPhoto } from '@/lib/person-photos-api';
import { cn } from '@/lib/utils';

interface PersonPhotoProps {
    personId?: number;
    photoUrl?: string | null;
    file?: File | null;
    name?: string;
    className?: string;
}

interface PhotoState {
    key: string;
    file: File | null;
    url: string;
    error: string;
}

export function PersonPhoto({ personId, photoUrl, file = null, name, className }: PersonPhotoProps) {
    const { t } = useTranslation();
    const key = `${personId ?? ''}:${photoUrl ?? ''}`;

    const [state, setState] = useState<PhotoState>({ key: '', file: null, url: '', error: '' });

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';

        async function load() {
            try {
                let blob: Blob;
                if (file) blob = file;
                else if (personId && photoUrl) blob = await getPersonPhoto(personId, controller.signal);
                else return;

                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setState({ key, file, url: objectUrl, error: '' });
            } catch (error: unknown) {
                if (controller.signal.aborted) return;
                setState({
                    key,
                    file,
                    url: '',
                    error: error instanceof ApiError && error.status === 404 ? 'common.noPhoto' : 'photo.loadFailed',
                });
            }
        }

        void load();

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [personId, photoUrl, file, key]);

    const matches = state.key === key && state.file === file;
    const url = matches ? state.url : '';
    const error = matches ? state.error : '';
    const hasSource = Boolean(file || (personId && photoUrl));

    return (
        <div className="space-y-2">
            <div
                className={cn(
                    'flex size-28 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-primary/8 shadow-sm',
                    hasSource && !url && !error && 'animate-pulse motion-reduce:animate-none',
                    className,
                )}
            >
                {url && !error ? (
                    <img
                        src={url}
                        alt={t('persons.photoAlt', { name: name ?? '' })}
                        className="h-full w-full object-cover"
                        onError={() =>
                            setState((current) =>
                                current.url === url ? { ...current, error: 'photo.loadFailed' } : current,
                            )
                        }
                    />
                ) : (
                    <UserRound aria-hidden="true" className="size-10 text-primary/70" />
                )}
            </div>

            {hasSource && !url && !error && (
                <p role="status" className="sr-only">
                    {t('photo.loading')}
                </p>
            )}
            {error && (
                <p role="status" className="text-xs text-muted-foreground">
                    {t(error)}
                </p>
            )}
        </div>
    );
}
