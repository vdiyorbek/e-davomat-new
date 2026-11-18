import type { StatusTone } from '@/components/common/StatusBadge';
import { addDays, todayInTashkent, weekdayIndex } from '@/lib/date';
import type { SummaryBand } from '@/types/attendance-summary';

/** Davr variantlari: tayyor oraliqlar va qo‘lda tanlanadigan oraliq. */
export const PERIODS = ['today', 'yesterday', 'last7', 'week', 'month', 'custom'] as const;

export type Period = (typeof PERIODS)[number];

/** Backend bilan bir xil: bir so‘rovda ko‘pi bilan 31 kun. */
export const MAX_PERIOD_DAYS = 31;

export type RangeError = 'invalid' | 'order' | 'future' | 'tooLong';

export function isPeriod(value: string | null): value is Period {
    return value !== null && (PERIODS as readonly string[]).includes(value);
}

export function isIsoDate(value: string): boolean {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Tayyor davr uchun sanalar oralig‘i. `custom` uchun — null. */
export function periodRange(period: Period, today = todayInTashkent()): { from: string; to: string } | null {
    switch (period) {
        case 'today':
            return { from: today, to: today };
        case 'yesterday': {
            const yesterday = addDays(today, -1);
            return { from: yesterday, to: yesterday };
        }
        case 'last7':
            return { from: addDays(today, -6), to: today };
        case 'week':
            // Hafta dushanbadan boshlanadi.
            return { from: addDays(today, -weekdayIndex(today)), to: today };
        case 'month':
            return { from: `${today.slice(0, 8)}01`, to: today };
        case 'custom':
            return null;
    }
}

/** Ikki sana orasidagi kunlar soni (ikkalasi ham kiradi). */
export function daysInRange(from: string, to: string): number {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    return Math.round((end - start) / 86_400_000) + 1;
}

export function validateRange(from: string, to: string, today = todayInTashkent()): RangeError | null {
    if (!isIsoDate(from) || !isIsoDate(to)) return 'invalid';
    if (from > to) return 'order';
    if (to > today) return 'future';
    if (daysInRange(from, to) > MAX_PERIOD_DAYS) return 'tooLong';
    return null;
}

/** Davomat darajasi rangi: Yomon — qizil, Yaxshi — sariq, A’lo — yashil. */
export function bandTone(band: SummaryBand | null): StatusTone {
    switch (band) {
        case 'LOW':
            return 'danger';
        case 'MEDIUM':
            return 'warning';
        case 'HIGH':
            return 'success';
        default:
            return 'neutral';
    }
}

/** Progress chizig‘i uchun fon rangi. */
export function bandBarClass(band: SummaryBand | null): string {
    switch (band) {
        case 'LOW':
            return 'bg-destructive';
        case 'MEDIUM':
            return 'bg-warning';
        case 'HIGH':
            return 'bg-success';
        default:
            return 'bg-muted-foreground/40';
    }
}
