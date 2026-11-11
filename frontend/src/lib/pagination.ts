export type PageItem = number | "gap-start" | "gap-end";

export function getPageItems(
  page: number,
  totalPages: number,
  siblings = 1,
): PageItem[] {
  const total = Math.max(totalPages, 1);
  const current = Math.min(Math.max(page, 1), total);
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  // 1, oxirgi, joriy, ikki tomondagi qo‘shnilar va ikkita «…».
  const maxItems = siblings * 2 + 5;

  if (total <= maxItems) return range(1, total);

  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, total - 1);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;
  const edgeCount = siblings * 2 + 3;

  if (!showLeftGap) return [...range(1, edgeCount), "gap-end", total];
  if (!showRightGap)
    return [1, "gap-start", ...range(total - edgeCount + 1, total)];

  return [1, "gap-start", ...range(left, right), "gap-end", total];
}
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * URL'dagi `limit` qiymati: yo‘q bo‘lsa — standart son,
 * ruxsat etilmagan son bo‘lsa — null (sahifa xato manzil deb ko‘rsatadi).
 */
export function parsePageSize(value: string | null): number | null {
  if (value === null) return DEFAULT_PAGE_SIZE;
  const size = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : null;
}
