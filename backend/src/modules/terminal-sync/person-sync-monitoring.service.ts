import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';
import { TerminalPersonSyncCheck } from './terminal-person-sync-check.entity';

export type MonitoringStatus =
  'ALL' | 'SUCCESS' | 'TIMEOUT' | 'ERROR' | 'NOT_CHECKED';

export interface MonitoringQuery {
  page: number;
  limit: number;
  status: MonitoringStatus;
  schoolId?: number;
  search?: string;
}

interface SummaryRow {
  totalTerminals: string | number;
  success: string | number;
  timeout: string | number;
  error: string | number;
  notChecked: string | number;
  terminalsWithMissingTeachers: string | number;
  missingTeachersTotal: string | number;
  staleCount: string | number;
}

interface CountRow {
  total: string | number;
}

interface TerminalRow {
  terminalId: number;
  terminalName: string;
  terminalHost: string;
  schoolId: number;
  schoolName: string;
  status: string;
  databaseTeachers: number | null;
  terminalUsers: number | null;
  missingCount: number | null;
  invalidPnfl: number | null;
  durationMs: number | null;
  errorCode: string | null;
  checkedAt: Date | null;
  jobId: string | null;
  isStale: number | string;
}

@Injectable()
export class PersonSyncMonitoringService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(TerminalPersonSyncCheck)
    private readonly checksRepository: Repository<TerminalPersonSyncCheck>,
  ) {}

  async getMonitoring(query: MonitoringQuery) {
    const { page, limit, status, schoolId, search } = query;

    const offset = (page - 1) * limit;
    const normalizedSearch = search?.trim() || undefined;

    // Har bir terminalning oxirgi diagnostika yozuvi.
    // terminalId va id bo‘yicha indeks bo‘lishi tavsiya etiladi.
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

    // Oxirgi tekshiruv 12 soatdan oshgan bo‘lsa,
    // eskirgan deb hisoblaymiz.
    // MySQL sessiyasi va checkedAt bir xil
    // vaqt zonasida bo‘lishi kerak.
    const staleCondition = `
      c.checkedAt IS NOT NULL
      AND c.checkedAt < DATE_SUB(
        NOW(),
        INTERVAL 12 HOUR
      )
    `;

    // ========================================
    // 1. UMUMIY STATISTIKA
    // ========================================

    const summaryConditions = ['t.isActive = 1'];

    const summaryParams: Array<string | number> = [];

    if (schoolId !== undefined) {
      summaryConditions.push('t.schoolId = ?');
      summaryParams.push(schoolId);
    }

    const summarySql = `
      SELECT
        COUNT(*) AS totalTerminals,

        COALESCE(SUM(
          CASE
            WHEN c.status = 'SUCCESS'
            THEN 1 ELSE 0
          END
        ), 0) AS success,

        COALESCE(SUM(
          CASE
            WHEN c.status = 'TIMEOUT'
            THEN 1 ELSE 0
          END
        ), 0) AS timeout,

        COALESCE(SUM(
          CASE
            WHEN c.status = 'ERROR'
            THEN 1 ELSE 0
          END
        ), 0) AS error,

        COALESCE(SUM(
          CASE
            WHEN c.id IS NULL
            THEN 1 ELSE 0
          END
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
        ), 0) AS missingTeachersTotal,

        COALESCE(SUM(
          CASE
            WHEN ${staleCondition}
            THEN 1 ELSE 0
          END
        ), 0) AS staleCount

      FROM terminals t

      ${latestJoin}

      WHERE ${summaryConditions.join(' AND ')}
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
      staleCount: Number(rawSummary?.staleCount ?? 0),
    };

    // ========================================
    // 2. FILTERLAR
    // ========================================

    const conditions = ['t.isActive = 1'];

    const params: Array<string | number> = [];

    if (schoolId !== undefined) {
      conditions.push('t.schoolId = ?');
      params.push(schoolId);
    }

    if (normalizedSearch) {
      conditions.push(`
        (
          LOCATE(LOWER(?), LOWER(t.name)) > 0
          OR LOCATE(LOWER(?), LOWER(t.host)) > 0
          OR LOCATE(LOWER(?), LOWER(s.name)) > 0
          OR CAST(t.id AS CHAR) = ?
        )
      `);

      params.push(
        normalizedSearch,
        normalizedSearch,
        normalizedSearch,
        normalizedSearch,
      );
    }

    if (status === 'NOT_CHECKED') {
      conditions.push('c.id IS NULL');
    } else if (status !== 'ALL') {
      conditions.push('c.status = ?');
      params.push(status);
    }

    const whereSql = conditions.join(' AND ');

    // Maktab nomini olish uchun JOIN.
    const schoolJoin = `
      INNER JOIN schools s
        ON s.id = t.schoolId
    `;

    // ========================================
    // 3. FILTERLANGAN TERMINALLAR SONI
    // ========================================

    const countSql = `
      SELECT COUNT(*) AS total

      FROM terminals t

      ${schoolJoin}

      ${latestJoin}

      WHERE ${whereSql}
    `;

    const countRows: CountRow[] = await this.terminalsRepository.query(
      countSql,
      params,
    );

    const totalItems = Number(countRows[0]?.total ?? 0);

    const totalPages = Math.ceil(totalItems / limit);

    // ========================================
    // 4. PAGINATION BILAN RO‘YXAT
    // ========================================

    const itemsSql = `
      SELECT
        t.id AS terminalId,
        t.name AS terminalName,
        t.host AS terminalHost,
        t.schoolId AS schoolId,

        s.name AS schoolName,

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
        c.jobId AS jobId,

        CASE
          WHEN ${staleCondition}
          THEN 1
          ELSE 0
        END AS isStale

      FROM terminals t

      ${schoolJoin}

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

    // ========================================
    // 5. JAVOBNI TAYYORLASH
    // ========================================

    const terminals = rows.map((row) => ({
      terminalId: Number(row.terminalId),

      terminalName: row.terminalName,
      terminalHost: row.terminalHost,

      schoolId: Number(row.schoolId),
      schoolName: row.schoolName,

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

      isStale: Number(row.isStale) === 1,
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
        search: normalizedSearch ?? '',
      },

      terminals,
    };
  }

  // ========================================
  // 6. TERMINAL TEKSHIRUVLARI TARIXI
  // ========================================

  async getTerminalHistory(terminalId: number, page = 1, limit = 10) {
    const terminal = await this.terminalsRepository.findOne({
      where: {
        id: terminalId,
      },
      select: {
        id: true,
        name: true,
        schoolId: true,
        isActive: true,
      },
    });

    if (!terminal) {
      throw new NotFoundException(`Terminal ${terminalId} topilmadi`);
    }

    const [checks, totalItems] = await this.checksRepository.findAndCount({
      where: {
        terminalId,
      },
      order: {
        id: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      terminal: {
        id: terminal.id,
        name: terminal.name,
        schoolId: terminal.schoolId,
        isActive: terminal.isActive,
      },

      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1 && totalItems > 0,
      },

      checks: checks.map((check) => ({
        id: check.id,
        status: check.status,
        databaseTeachers: check.databaseTeachers,
        terminalUsers: check.terminalUsers,
        missingCount: check.missingCount,
        invalidPnfl: check.invalidPnfl,
        durationMs: check.durationMs,
        errorCode: check.errorCode,
        jobId: check.jobId,
        checkedAt: check.checkedAt,
      })),
    };
  }
}
