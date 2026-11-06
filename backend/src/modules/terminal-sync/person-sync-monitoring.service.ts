import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';

export type MonitoringStatus =
  'ALL' | 'SUCCESS' | 'TIMEOUT' | 'ERROR' | 'NOT_CHECKED';

export interface MonitoringQuery {
  page: number;
  limit: number;
  status: MonitoringStatus;
  schoolId?: number;
}

interface SummaryRow {
  totalTerminals: string | number;
  success: string | number;
  timeout: string | number;
  error: string | number;
  notChecked: string | number;
  terminalsWithMissingTeachers: string | number;
  missingTeachersTotal: string | number;
}

interface CountRow {
  total: string | number;
}

interface TerminalRow {
  terminalId: number;
  terminalName: string;
  schoolId: number;
  status: string;
  databaseTeachers: number | null;
  terminalUsers: number | null;
  missingCount: number | null;
  invalidPnfl: number | null;
  durationMs: number | null;
  errorCode: string | null;
  checkedAt: Date | null;
  jobId: string | null;
}

@Injectable()
export class PersonSyncMonitoringService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
  ) {}

  async getMonitoring(query: MonitoringQuery) {
    const { page, limit, status, schoolId } = query;

    const offset = (page - 1) * limit;

    // Har terminalning oxirgi yozilgan
    // diagnostikasini topamiz.
    const latestJoin = `
      LEFT JOIN terminal_person_sync_checks c
        ON c.id = (
          SELECT c2.id
          FROM terminal_person_sync_checks c2
          WHERE c2.terminalId = t.id
          ORDER BY c2.id DESC
          LIMIT 1
        )
    `;

    // Maktab bo‘yicha umumiy statistika.
    const summaryWhere = ['t.isActive = 1'];

    const summaryParams: Array<number | string> = [];

    if (schoolId !== undefined) {
      summaryWhere.push('t.schoolId = ?');
      summaryParams.push(schoolId);
    }

    const summarySql = `
      SELECT
        COUNT(*) AS totalTerminals,

        COALESCE(SUM(
          CASE WHEN c.status = 'SUCCESS'
          THEN 1 ELSE 0 END
        ), 0) AS success,

        COALESCE(SUM(
          CASE WHEN c.status = 'TIMEOUT'
          THEN 1 ELSE 0 END
        ), 0) AS timeout,

        COALESCE(SUM(
          CASE WHEN c.status = 'ERROR'
          THEN 1 ELSE 0 END
        ), 0) AS error,

        COALESCE(SUM(
          CASE WHEN c.id IS NULL
          THEN 1 ELSE 0 END
        ), 0) AS notChecked,

        COALESCE(SUM(
          CASE
            WHEN c.status = 'SUCCESS'
              AND c.missingCount > 0
            THEN 1 ELSE 0
          END
        ), 0) AS terminalsWithMissingTeachers,

        COALESCE(SUM(
          CASE
            WHEN c.status = 'SUCCESS'
            THEN COALESCE(c.missingCount, 0)
            ELSE 0
          END
        ), 0) AS missingTeachersTotal

      FROM terminals t
      ${latestJoin}
      WHERE ${summaryWhere.join(' AND ')}
    `;

    const summaryRows: SummaryRow[] = await this.terminalsRepository.query(
      summarySql,
      summaryParams,
    );

    const rawSummary = summaryRows[0];

    const summary = {
      totalTerminals: Number(rawSummary?.totalTerminals ?? 0),
      success: Number(rawSummary?.success ?? 0),
      timeout: Number(rawSummary?.timeout ?? 0),
      error: Number(rawSummary?.error ?? 0),
      notChecked: Number(rawSummary?.notChecked ?? 0),
      terminalsWithMissingTeachers: Number(
        rawSummary?.terminalsWithMissingTeachers ?? 0,
      ),
      missingTeachersTotal: Number(rawSummary?.missingTeachersTotal ?? 0),
    };

    // Endi ro‘yxat uchun filterlarni qo‘shamiz.
    const conditions = ['t.isActive = 1'];

    const params: Array<string | number> = [];

    if (schoolId !== undefined) {
      conditions.push('t.schoolId = ?');
      params.push(schoolId);
    }

    if (status === 'NOT_CHECKED') {
      conditions.push('c.id IS NULL');
    } else if (status !== 'ALL') {
      conditions.push('c.status = ?');
      params.push(status);
    }

    const whereSql = conditions.join(' AND ');

    // Filterdan keyingi umumiy son.
    const countSql = `
      SELECT COUNT(*) AS total
      FROM terminals t
      ${latestJoin}
      WHERE ${whereSql}
    `;

    const countRows: CountRow[] = await this.terminalsRepository.query(
      countSql,
      params,
    );

    const totalItems = Number(countRows[0]?.total ?? 0);

    const totalPages = Math.ceil(totalItems / limit);

    // Pagination MySQL darajasida ishlaydi.
    const itemsSql = `
      SELECT
        t.id AS terminalId,
        t.name AS terminalName,
        t.schoolId AS schoolId,

        COALESCE(
          c.status,
          'NOT_CHECKED'
        ) AS status,

        c.databaseTeachers AS databaseTeachers,
        c.terminalUsers AS terminalUsers,
        c.missingCount AS missingCount,
        c.invalidPnfl AS invalidPnfl,
        c.durationMs AS durationMs,
        c.errorCode AS errorCode,
        c.checkedAt AS checkedAt,
        c.jobId AS jobId

      FROM terminals t

      ${latestJoin}

      WHERE ${whereSql}

      ORDER BY
        CASE
          WHEN c.status = 'TIMEOUT' THEN 0
          WHEN c.status = 'ERROR' THEN 1
          WHEN c.id IS NULL THEN 2
          WHEN c.status = 'SUCCESS' THEN 3
          ELSE 4
        END ASC,
        t.schoolId ASC,
        t.id ASC

      LIMIT ? OFFSET ?
    `;

    const rows: TerminalRow[] = await this.terminalsRepository.query(itemsSql, [
      ...params,
      limit,
      offset,
    ]);

    const terminals = rows.map((row) => ({
      terminalId: Number(row.terminalId),
      terminalName: row.terminalName,
      schoolId: Number(row.schoolId),
      status: row.status,

      databaseTeachers:
        row.databaseTeachers === null ? null : Number(row.databaseTeachers),

      terminalUsers:
        row.terminalUsers === null ? null : Number(row.terminalUsers),

      missingCount: row.missingCount === null ? null : Number(row.missingCount),

      invalidPnfl: row.invalidPnfl === null ? null : Number(row.invalidPnfl),

      durationMs: row.durationMs === null ? null : Number(row.durationMs),

      errorCode: row.errorCode,
      checkedAt: row.checkedAt,
      jobId: row.jobId,
    }));

    return {
      generatedAt: new Date().toISOString(),
      summary,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
      filters: {
        status,
        schoolId: schoolId ?? null,
      },
      terminals,
    };
  }
}
