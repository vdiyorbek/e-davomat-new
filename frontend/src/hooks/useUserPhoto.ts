import { useEffect, useState } from 'react';
import { getUserPhoto } from '@/lib/user-photos-api';

/**
 * Foydalanuvchi rasmini JWT bilan yuklab, vaqtinchalik object URL qaytaradi.
 * `photoUrl` bo‘sh bo‘lsa yoki yuklashda xato bo‘lsa — bo‘sh satr.
 */
export function useUserPhoto(userId: number | undefined, photoUrl: string | null | undefined) {
    const key = `${userId ?? ''}:${photoUrl ?? ''}`;
    const [state, setState] = useState({ key: '', url: '' });

    useEffect(() => {
        if (!userId || !photoUrl) return;

        const controller = new AbortController();
        let objectUrl = '';

        void getUserPhoto(userId, controller.signal)
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setState({ key, url: objectUrl });
            })
            .catch(() => undefined);

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [userId, photoUrl, key]);

    return state.key === key ? state.url : '';
}
