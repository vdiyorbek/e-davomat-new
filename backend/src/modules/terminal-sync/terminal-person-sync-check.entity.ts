import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Terminal } from '../terminals/terminal.entity';

export enum TerminalPersonSyncCheckStatus {
  SUCCESS = 'SUCCESS',
  TIMEOUT = 'TIMEOUT',
  ERROR = 'ERROR',
}

@Entity('terminal_person_sync_checks')
@Index('IDX_person_sync_checks_terminal_date', ['terminalId', 'createdAt'])
@Index('IDX_person_sync_checks_status_date', ['status', 'createdAt'])
export class TerminalPersonSyncCheck {
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

  @ManyToOne(() => Terminal, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'terminalId',
  })
  terminal!: Terminal;

  @Column({
    type: 'int',
    unsigned: true,
  })
  schoolId!: number;

  @Column({
    type: 'enum',
    enum: TerminalPersonSyncCheckStatus,
  })
  status!: TerminalPersonSyncCheckStatus;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  databaseTeachers!: number | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  terminalUsers!: number | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  missingCount!: number | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  invalidPnfl!: number | null;

  @Column({
    type: 'int',
    unsigned: true,
  })
  durationMs!: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  errorCode!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  jobId!: string | null;

  @Column({
    type: 'datetime',
    precision: 3,
  })
  checkedAt!: Date;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
