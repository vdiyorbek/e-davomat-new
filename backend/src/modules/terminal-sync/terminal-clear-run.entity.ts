import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TerminalClearRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

/**
 * Terminal xotirasini tozalash tarixi.
 * Vaqtlarni dastur yozadi (UTC) — MySQL CURRENT_TIMESTAMP'iga
 * tayanmaymiz, u server vaqt zonasida yoziladi.
 */
@Entity('terminal_clear_runs')
@Index('IDX_terminal_clear_runs_created', ['createdAt'])
@Index('IDX_terminal_clear_runs_terminal_created', ['terminalId', 'createdAt'])
export class TerminalClearRun {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'int', unsigned: true })
  terminalId!: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  requestedByUserId!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  jobId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: TerminalClearRunStatus;

  @Column({ type: 'int', unsigned: true, nullable: true })
  usersBefore!: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  usersAfter!: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  facesAfter!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  finishedAt!: Date | null;
}
