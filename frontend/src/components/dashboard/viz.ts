/** Xarita va jadval rang bosqichlari: davomat foizi chegaralari. */
export const RATE_BREAKS = [70, 80, 90, 95] as const;

export function rateBin(rate: number | null | undefined): number | null {
    if (rate === null || rate === undefined) return null;
    const index = RATE_BREAKS.findIndex((limit) => rate < limit);
    return index === -1 ? RATE_BREAKS.length : index;
}

export function binFill(bin: number | null): string {
    return bin === null ? 'var(--viz-nodata)' : `var(--viz-seq-${bin + 1})`;
}

/** Rang ustidagi matn: och bosqichlarda qora, to‘qlarida oq. */
export function binInk(bin: number | null, dark: boolean): string {
    if (bin === null) return 'var(--foreground)';
    const light = dark ? bin >= 3 : bin <= 1;
    return light ? '#0b0b0b' : '#ffffff';
}

export function formatRate(rate: number | null | undefined): string {
    return rate === null || rate === undefined ? '—' : `${rate.toLocaleString('uz-UZ', { maximumFractionDigits: 1 })}%`;
}

export function formatCount(value: number): string {
    return value.toLocaleString('uz-UZ').replace(/\u00a0/g, ' ');
}
