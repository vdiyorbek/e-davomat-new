import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

export interface CaseReportData {
  caseId: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: Date;
  closedAt: Date | null;
  student: {
    fullName: string;
    pnfl: string;
    school: string;
    className: string | null;
    mahalla: string | null;
  };
  inspectorName: string;
  absentSince: string;
  absentDays: number;
  visitDate: string | null;
  spokeWith: string | null;
  reason: string | null;
  findings: string | null;
  actionsTaken: string | null;
  outcome: string | null;
  followUpDate: string | null;
}

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.42, 0.46);
const LINE = rgb(0.8, 0.82, 0.85);

/** YYYY-MM-DD → DD.MM.YYYY */
export function pdfDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      // Juda uzun so'z — belgilab bo'laklaymiz.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(rest.slice(0, cut), size) > width
        )
          cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** O'rganilgan o'quvchi bo'yicha rasmiy hisobot (A4, DejaVu — o'zbekcha harflar uchun). */
export async function buildCaseReportPdf(
  data: CaseReportData,
  labels: { contact: string; reason: string; outcome: string },
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(
    await readFile(join(FONT_DIR, 'DejaVuSans.ttf')),
    { subset: true },
  );
  const bold = await doc.embedFont(
    await readFile(join(FONT_DIR, 'DejaVuSans-Bold.ttf')),
    { subset: true },
  );
  doc.setTitle(`O‘rganish hisoboti № ${data.caseId}`);
  doc.setCreator('E-davomat');

  const contentW = PAGE_W - MARGIN * 2;
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (need: number) => {
    if (y - need < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const text = (
    value: string,
    opts: {
      size?: number;
      font?: PDFFont;
      x?: number;
      color?: ReturnType<typeof rgb>;
    } = {},
  ) => {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? regular;
    const x = opts.x ?? MARGIN;
    const width = PAGE_W - MARGIN - x;
    for (const line of wrap(value, font, size, width)) {
      ensure(size + 5);
      page.drawText(line, {
        x,
        y: y - size,
        size,
        font,
        color: opts.color ?? INK,
      });
      y -= size + 5;
    }
  };
  const rule = () => {
    ensure(10);
    page.drawLine({
      start: { x: MARGIN, y: y - 3 },
      end: { x: PAGE_W - MARGIN, y: y - 3 },
      thickness: 0.7,
      color: LINE,
    });
    y -= 10;
  };
  const heading = (value: string) => {
    y -= 8;
    ensure(30);
    text(value, { size: 12, font: bold });
    rule();
  };
  const field = (label: string, value: string | null) => {
    const labelW = 150;
    const lines = wrap(
      value && value.trim() ? value : '—',
      regular,
      10.5,
      contentW - labelW,
    );
    ensure(lines.length * 15.5);
    page.drawText(label, {
      x: MARGIN,
      y: y - 10.5,
      size: 10,
      font: regular,
      color: MUTED,
    });
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN + labelW,
        y: y - 10.5,
        size: 10.5,
        font: regular,
        color: INK,
      });
      y -= 15.5;
    }
  };

  const title = 'Darsga kelmayotgan o‘quvchini o‘rganish hisoboti';
  text(title, { size: 15, font: bold });
  text(
    `№ ${data.caseId} · holati: ${data.status === 'CLOSED' ? 'yopilgan' : 'jarayonda'} · ` +
      `ochilgan: ${pdfDate(data.createdAt.toISOString())}` +
      (data.closedAt
        ? ` · yopilgan: ${pdfDate(data.closedAt.toISOString())}`
        : ''),
    { size: 9.5, color: MUTED },
  );
  rule();

  heading('1. O‘quvchi');
  field('F.I.Sh.', data.student.fullName);
  field('JSHSHIR (PINFL)', data.student.pnfl);
  field('Maktab', data.student.school);
  field('Sinf', data.student.className);
  field('Mahalla', data.student.mahalla);

  heading('2. Darsga kelmaslik');
  field('Kelmaslik boshlangan sana', pdfDate(data.absentSince));
  field(
    'Ketma-ket o‘quv kunlari',
    `${data.absentDays} kun (ish ochilgan paytda)`,
  );

  heading('3. O‘rganish natijalari');
  field('Uchastkavoy', data.inspectorName);
  field('Tashrif sanasi', pdfDate(data.visitDate));
  field('Kim bilan suhbat', labels.contact);
  field('Aniqlangan sabab', labels.reason);
  y -= 4;
  text('Aniqlangan holatlar:', { size: 10, color: MUTED });
  text(data.findings?.trim() || '—');
  y -= 4;
  text('Ko‘rilgan choralar:', { size: 10, color: MUTED });
  text(data.actionsTaken?.trim() || '—');

  heading('4. Yakun');
  field('Natija', labels.outcome);
  field('Keyingi nazorat sanasi', pdfDate(data.followUpDate));

  y -= 28;
  ensure(60);
  page.drawLine({
    start: { x: MARGIN, y: y - 14 },
    end: { x: MARGIN + 190, y: y - 14 },
    thickness: 0.7,
    color: INK,
  });
  page.drawText(`Uchastkavoy: ${data.inspectorName}`, {
    x: MARGIN,
    y: y - 28,
    size: 9,
    font: regular,
    color: MUTED,
  });
  page.drawText('(imzo)', {
    x: MARGIN + 70,
    y: y - 40,
    size: 8,
    font: regular,
    color: MUTED,
  });

  // Pastki kolontitul: har sahifada.
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      `E-davomat · hisobot № ${data.caseId} · ${index + 1}/${pages.length}`,
      { x: MARGIN, y: 28, size: 8, font: regular, color: MUTED },
    );
  });

  return Buffer.from(await doc.save());
}
