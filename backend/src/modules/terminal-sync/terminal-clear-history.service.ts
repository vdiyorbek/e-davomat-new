import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  TerminalClearRun,
  TerminalClearRunStatus as Status,
} from './terminal-clear-run.entity';

export interface ClearRunResult {
  usersBefore: number;
  usersAfter: number;
  facesAfter: number | null;
  cleared: boolean;
}

/** Terminal xotirasini tozalash amallarini tarixga yozadi. */
@Injectable()
export class TerminalClearHistoryService {
  constructor(
    @InjectRepository(TerminalClearRun)
    private readonly runs: Repository<TerminalClearRun>,
  ) {}

  create(
    terminalId: number,
    requestedByUserId: number,
    jobId: string,
  ): Promise<TerminalClearRun> {
    return this.runs.save(
      this.runs.create({
        terminalId,
        requestedByUserId,
        jobId,
        status: Status.QUEUED,
        usersBefore: null,
        usersAfter: null,
        facesAfter: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        startedAt: null,
        finishedAt: null,
      }),
    );
  }

  async markRunning(id: string): Promise<void> {
    await this.runs.update(
      { id, status: Status.QUEUED },
      { status: Status.RUNNING, startedAt: new Date() },
    );
  }

  async markFinished(id: string, result: ClearRunResult): Promise<void> {
    await this.runs.update(
      { id, status: In([Status.QUEUED, Status.RUNNING]) },
      {
        status: result.cleared ? Status.SUCCESS : Status.PARTIAL,
        usersBefore: result.usersBefore,
        usersAfter: result.usersAfter,
        facesAfter: result.facesAfter,
        finishedAt: new Date(),
      },
    );
  }

  /** Faqat hali yakunlanmagan yozuvni FAILED qiladi — takroriy chaqiruv xavfsiz. */
  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.runs.update(
      { id, status: In([Status.QUEUED, Status.RUNNING]) },
      {
        status: Status.FAILED,
        errorCode: errorCode.slice(0, 50),
        errorMessage: errorMessage.slice(0, 255),
        finishedAt: new Date(),
      },
    );
  }
}
