import { PDFDocument } from 'pdf-lib';

export interface PageRange {
  start: number;
  end: number;
}

/** AI'ga bir so‘rovda yuboriladigan sahifalar chegarasi. */
export const MAX_PAGES = 60;

/**
 * Mavzular sahifalarini birlashtiradi va chegaraga sig‘diradi: har bir
 * mavzudan teng ulush olinadi, shunda bitta uzun mavzu boshqalarini siqib
 * chiqarmaydi. Natija — tartiblangan, takrorsiz 1-dan boshlanuvchi raqamlar.
 */
export function selectPages(ranges: PageRange[], limit = MAX_PAGES): number[] {
  const valid = ranges
    .filter((range) => range.start > 0 && range.end >= range.start)
    .map((range) => ({
      start: range.start,
      end: Math.min(range.end, range.start + 200),
    }));

  if (valid.length === 0) return [];

  const perTopic = Math.max(1, Math.floor(limit / valid.length));
  const pages = new Set<number>();

  for (const range of valid) {
    for (
      let page = range.start;
      page <= range.end && page < range.start + perTopic;
      page++
    ) {
      pages.add(page);
    }
  }

  return [...pages].sort((a, b) => a - b).slice(0, limit);
}

/** Darslikdan faqat kerakli sahifalarni yangi PDF qilib ajratadi. */
export async function extractPages(
  pdf: Buffer,
  pages: number[],
): Promise<Buffer> {
  const source = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const count = source.getPageCount();
  const indexes = pages
    .map((page) => page - 1)
    .filter((index) => index >= 0 && index < count);

  if (indexes.length === 0) {
    throw new Error('Mavzu sahifalari darslik PDF’ida topilmadi');
  }

  const target = await PDFDocument.create();
  const copied = await target.copyPages(source, indexes);
  for (const page of copied) target.addPage(page);

  return Buffer.from(await target.save());
}
