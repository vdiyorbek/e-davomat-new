import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/user.entity';
import { Terminal } from '../terminals/terminal.entity';
import { positiveInteger } from './person-sync-history.controller';
import {
  TerminalClearRun,
  TerminalClearRunStatus,
} from './terminal-clear-run.entity';

const STATUSES = Object.values(TerminalClearRunStatus);

@Controller('person-sync-queue/clear-history')
@Roles(UserRole.SUPER_ADMIN)
export class TerminalClearHistoryController {
  constructor(
    @InjectRepository(TerminalClearRun)
    private readonly runs: Repository<TerminalClearRun>,

    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,

    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  @Get()
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('terminalId') terminalIdRaw?: string,
  ) {
    const page = positiveInteger(pageRaw, 1, 1000000);
    const limit = positiveInteger(limitRaw, 20, 100);
    const status = statusRaw || 'ALL';

    if (
      status !== 'ALL' &&
      !STATUSES.includes(status as TerminalClearRunStatus)
    ) {
      throw new BadRequestException('Noto‘g‘ri holat');
    }

    const terminalId =
      terminalIdRaw === undefined || terminalIdRaw === ''
        ? null
        : positiveInteger(terminalIdRaw, 1, 4294967295);

    const [rows, totalItems] = await this.runs.findAndCount({
      where: {
        ...(status !== 'ALL'
          ? { status: status as TerminalClearRunStatus }
          : {}),
        ...(terminalId !== null ? { terminalId } : {}),
      },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const terminalIds = [...new Set(rows.map((run) => run.terminalId))];
    const userIds = [
      ...new Set(
        rows
          .map((run) => run.requestedByUserId)
          .filter((id): id is number => id !== null),
      ),
    ];

    const terminals = terminalIds.length
      ? await this.terminals.find({
          where: { id: In(terminalIds) },
          select: { id: true, name: true },
        })
      : [];

    const users = userIds.length
      ? await this.users.find({
          where: { id: In(userIds) },
          select: { id: true, login: true, firstName: true, lastName: true },
        })
      : [];

    const terminalNames = new Map(
      terminals.map((terminal) => [terminal.id, terminal.name]),
    );

    const userNames = new Map(
      users.map((user) => [
        user.id,
        [user.lastName, user.firstName].filter(Boolean).join(' ') || user.login,
      ]),
    );

    return {
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
      runs: rows.map((run) => ({
        id: run.id,
        terminalId: run.terminalId,
        terminalName: terminalNames.get(run.terminalId) ?? null,
        requestedByUserId: run.requestedByUserId,
        requestedByName:
          run.requestedByUserId !== null
            ? (userNames.get(run.requestedByUserId) ?? null)
            : null,
        status: run.status,
        usersBefore: run.usersBefore,
        usersAfter: run.usersAfter,
        facesAfter: run.facesAfter,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })),
    };
  }
}
