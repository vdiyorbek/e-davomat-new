import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TerminalSyncRunStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('terminal_sync_runs')
@Index('IDX_terminal_sync_runs_terminal_started', ['terminalId', 'startedAt'])
@Index('IDX_terminal_sync_runs_finished_at', ['finishedAt'])
export class TerminalSyncRun {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
  })
  id!: string;

  @Column({
    type: 'int',
    unsigned: true,
  })
  terminalId!: number;

  @Column({
    type: 'enum',
    enum: TerminalSyncRunStatus,
  })
  status!: TerminalSyncRunStatus;

  @Column({
    type: 'datetime',
    precision: 3,
  })
  startedAt!: Date;

  @Column({
    type: 'datetime',
    precision: 3,
  })
  finishedAt!: Date;

  @Column({
    type: 'int',
    unsigned: true,
  })
  durationMs!: number;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  cursorBefore!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  cursorAfter!: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  errorCode!: string | null;
}
