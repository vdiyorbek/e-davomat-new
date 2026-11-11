import { useEffect, useEffectEvent } from 'react';

/**
 * `callback`ni har `delayMs` millisoniyada chaqiradi.
 * Callback har renderda yangilansa ham interval qayta yaratilmaydi.
 * Sahifa yashirin bo‘lsa (boshqa tab) chaqirilmaydi.
 */
export function useInterval(callback: () => void, delayMs: number | null) {
    const tick = useEffectEvent(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        callback();
    });

    useEffect(() => {
        if (delayMs === null) return;
        const id = window.setInterval(() => tick(), delayMs);
        return () => window.clearInterval(id);
    }, [delayMs]);
}
