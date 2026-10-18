import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { DailyAttendanceReadService } from './daily-attendance-read.service';
import { GetDailyAttendanceQueryDto } from './dto/get-daily-attendance-query.dto';
import { MembershipType } from '../school-memberships/school-membership.entity';
const BATCH_SIZE = 100;

const STATUS_LABELS: Record<string, string> = {
  inside: 'Kelgan',
  left: 'Ketgan',
  excused: 'Sababli',
  absent: 'Kelmagan',
  anomaly: 'Tekshirish kerak',
  day_off: 'Dam olish kuni',
  unconfigured: 'Jadval sozlanmagan',
  conflict: 'Kalendar ziddiyati',
};

const REASON_LABELS: Record<string, string> = {
  ILLNESS: 'Sog‘lig‘i sababli',
  OLYMPIAD: 'Olimpiada',
  FAMILY: 'Oilaviy sabab',
  OTHER: 'Boshqa',
};

function formatTime(value: string | Date | null): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

// Excel kataklarida formulaga aylanib ketmasligi uchun.
function safeText(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

@Injectable()
export class DailyAttendanceExportService {
  constructor(private readonly readService: DailyAttendanceReadService) {}

  async exportExcel(
    query: GetDailyAttendanceQueryDto,
    user: AuthenticatedUser,
    response: Response,
    options: {
      membershipType?: MembershipType;
      filenamePrefix?: string;
    } = {},
  ): Promise<void> {
    const membershipType = options.membershipType ?? MembershipType.STUDENT;
    const filenamePrefix = options.filenamePrefix ?? 'davomat';
    const isTeacher = membershipType === MembershipType.TEACHER;
    // Pagination foydalanuvchi tanlovidan mustaqil.
    const firstBatch = await this.readService.findAll(
      { ...query, page: 1, limit: BATCH_SIZE },
      user,
      membershipType,
    );

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenamePrefix}-${query.date}.xlsx"`,
    );

    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: response,
        useStyles: true,
        useSharedStrings: false,
      });

      let sheetIndex = 0;
      let sheetRows = 0;

      function createSheet() {
        sheetIndex++;

        const sheet = workbook.addWorksheet(
          sheetIndex === 1 ? 'Davomat' : `Davomat ${sheetIndex}`,
        );

        sheet.columns = [
          { header: '№', key: 'number', width: 9 },
          { header: 'Sana', key: 'date', width: 16 },
          { header: 'Viloyat', key: 'region', width: 24 },
          { header: 'Tuman', key: 'district', width: 24 },
          { header: 'Maktab', key: 'school', width: 27 },

          ...(!isTeacher
            ? [{ header: 'Sinf', key: 'className', width: 15 }]
            : []),

          { header: 'F.I.Sh.', key: 'fullName', width: 45 },
          { header: 'Kirish', key: 'firstIn', width: 18 },
          { header: 'Chiqish', key: 'lastOut', width: 18 },
          { header: 'Holat', key: 'status', width: 26 },

          ...(!isTeacher
            ? [{ header: 'Sabab', key: 'reason', width: 26 }]
            : []),
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).commit();

        sheetRows = 0;

        return sheet;
      }

      let sheet = createSheet();
      let exported = 0;
      let page = 1;
      let batch = firstBatch;

      while (batch.data.length > 0) {
        if (response.destroyed) return;

        for (const item of batch.data) {
          // Excel varag‘ining maksimal qator chegarasi.
          if (sheetRows >= 1_048_575) {
            sheet.commit();
            sheet = createSheet();
          }

          const fullName = item.person
            ? [
                item.person.lastName,
                item.person.firstName,
                item.person.middleName,
              ]
                .filter(Boolean)
                .join(' ')
            : '';

          sheet
            .addRow({
              number: ++exported,
              date: item.date,
              region: safeText(item.region.name),
              district: safeText(item.district.name),
              school: safeText(item.school.name),
              className: safeText(item.className ?? ''),
              fullName: safeText(fullName),
              firstIn: formatTime(item.firstInTime),
              lastOut: formatTime(item.lastOutTime),
              status:
                STATUS_LABELS[item.attendanceStatus] ?? item.attendanceStatus,
              reason: item.excuseReason
                ? (REASON_LABELS[item.excuseReason] ?? '')
                : '',
            })
            .commit();

          sheetRows++;
        }

        if (exported >= firstBatch.total) break;

        page++;

        batch = await this.readService.findAll(
          { ...query, page, limit: BATCH_SIZE },
          user,
          membershipType,
        );
      }

      sheet.commit();
      await workbook.commit();
    } catch (error: unknown) {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }

      throw error;
    }
  }
}
