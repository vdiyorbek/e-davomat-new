/** Maktab haftasi: 1 = dushanba … 6 = shanba (backend `dayOfWeek` qiymatlari). */
export const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] as const;

/** «08:00:00» → «08:00». */
export function shortTime(value: string): string {
    return value.slice(0, 5);
}
