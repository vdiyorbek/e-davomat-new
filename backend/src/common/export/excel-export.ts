import ExcelJS from 'exceljs';
import type { Response } from 'express';

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel katagida formulaga aylanib ketmasligi uchun. */
export function safeCell(value: unknown): string {
  const text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  // Telefon raqami (+998...) formula emas — o‘zgartirilmaydi.
  if (/^\+?\d[\d\s()-]*$/.test(text)) return text;
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function fullName(
  person: {
    lastName?: unknown;
    firstName?: unknown;
    middleName?: unknown;
  } | null,
): string {
  if (!person) return '';
  return [person.lastName, person.firstName, person.middleName]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(' ');
}

/**
 * Sahifalab o‘qiladigan ro‘yxatni .xlsx qilib oqim bilan yuboradi.
 * `fetchPage` ruxsat tekshiruvini o‘z ichiga oladi; birinchi sahifa sarlavhalar
 * yozilishidan OLDIN o‘qiladi, shuning uchun ruxsat xatosi oddiy JSON xato bo‘ladi.
 */
export async function streamExcel<T>(
  response: Response,
  options: {
    filename: string;
    sheetName: string;
    columns: ExcelColumn[];
    maxRows?: number;
    fetchPage: (page: number) => Promise<T[]>;
    toRow: (item: T, number: number) => Record<string, unknown>;
  },
): Promise<void> {
  const maxRows = options.maxRows ?? 100_000;
  let page = 1;
  let rows = await options.fetchPage(page);

  response.setHeader('Content-Type', XLSX_TYPE);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${options.filename}"`,
  );
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false,
    });
    const sheet = workbook.addWorksheet(options.sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = options.columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();

    let number = 0;
    while (rows.length > 0 && number < maxRows) {
      if (response.destroyed) return;
      for (const item of rows) {
        number += 1;
        sheet.addRow(options.toRow(item, number)).commit();
      }
      page += 1;
      rows = await options.fetchPage(page);
    }

    sheet.commit();
    await workbook.commit();
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.removeHeader('Content-Disposition');
    throw error;
  }
}
