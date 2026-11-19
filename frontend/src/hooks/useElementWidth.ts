import { useEffect, useRef, useState } from 'react';

/** Konteyner kengligi (grafiklar SVG’ni cho‘zmasdan qayta chizishi uchun). */
export function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}
