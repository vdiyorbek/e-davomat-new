
import { useEffect, useState } from 'react';
import { Expand, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/lib/api';
import { getPersonPhoto } from '@/lib/person-photos-api';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';

interface PersonPhotoProps {
    personId?: number;
    photoUrl?: string | null;
    file?: File | null;
    name?: string;
    className?: string;

    // Faqat kerakli sahifalarda yoqamiz
    enlargeOnClick?: boolean;
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
    name,
    className,
    enlargeOnClick = false,
}: PersonPhotoProps) {
    const { t } = useTranslation();

    const key = `${personId ?? ''}:${photoUrl ?? ''}`;

    const [state, setState] = useState<PhotoState>({
        key: '',
        file: null,
        url: '',
        error: '',
    });

    const [previewOpen, setPreviewOpen] = useState(false);

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
                            ? 'common.noPhoto'
                            : 'photo.loadFailed',
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

    const matches =
        state.key === key &&
        state.file === file;

    const url = matches ? state.url : '';
    const error = matches ? state.error : '';

    const hasSource = Boolean(
        file || (personId && photoUrl),
    );

    const canEnlarge = enlargeOnClick && Boolean(url) && !error;

    const photoClassName = cn(
        'group relative flex size-28 items-center justify-center',
        'overflow-hidden rounded-2xl border-4 border-background',
        'bg-primary/8 shadow-sm',
        hasSource &&
        !url &&
        !error &&
        'animate-pulse motion-reduce:animate-none',
        canEnlarge &&
        'cursor-zoom-in transition-transform hover:scale-[1.03]',
        className,
    );

    const photoContent = url && !error ? (
        <>
            <img
                src={url}
                alt={t('persons.photoAlt', {
                    name: name ?? '',
                })}
                className="h-full w-full object-cover"
                onError={() =>
                    setState((current) =>
                        current.url === url
                            ? {
                                ...current,
                                error: 'photo.loadFailed',
                            }
                            : current,
                    )
                }
            />

            {canEnlarge && (
                <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100"
                >
                    <Expand className="size-6" />
                </span>
            )}
        </>
    ) : (
        <UserRound
            aria-hidden="true"
            className="size-10 text-primary/70"
        />
    );

    return (
        <div className="min-w-0 space-y-2">
            {canEnlarge ? (
                <button
                    type="button"
                    className={cn(
                        photoClassName,
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-ring',
                        'focus-visible:ring-offset-2',
                    )}
                    aria-label="Rasmni kattalashtirish"
                    title="Rasmni kattalashtirish"
                    onClick={() => setPreviewOpen(true)}
                >
                    {photoContent}
                </button>
            ) : (
                <div className={photoClassName}>
                    {photoContent}
                </div>
            )}

            {hasSource && !url && !error && (
                <p role="status" className="sr-only">
                    {t('photo.loading')}
                </p>
            )}

            {error && (
                <p
                    role="status"
                    className="text-xs text-muted-foreground"
                >
                    {t(error)}
                </p>
            )}

            <Dialog
                open={previewOpen && canEnlarge}
                onOpenChange={setPreviewOpen}
            >
                <DialogContent
                    className={cn(
                        'flex w-[calc(100vw-2rem)]',
                        'max-w-[760px] flex-col',
                        'items-center gap-4',
                        'overflow-hidden p-4',
                        'sm:max-w-[760px] sm:p-6',
                    )}
                >
                    <DialogTitle className="max-w-full pr-8 text-center text-base font-semibold break-words">
                        {name || 'Shaxs rasmi'}
                    </DialogTitle>

                    {url && (
                        <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-black/10 p-2">
                            <img
                                src={url}
                                alt={name || 'Shaxs rasmi'}
                                className={cn(
                                    'block max-h-[75dvh]',
                                    'max-w-full object-contain',
                                    'rounded-lg',
                                )}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
