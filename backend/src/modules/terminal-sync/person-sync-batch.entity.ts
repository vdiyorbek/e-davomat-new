import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PersonSyncBatchType {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  BOTH = 'BOTH',
}

export enum PersonSyncBatchStatus {
  QUEUING = 'QUEUING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

@Entity('person_sync_batches')
@Index('IDX_ps_batches_date', ['createdAt'])
@Index('IDX_ps_batches_status_date', ['status', 'createdAt'])
export class PersonSyncBatch {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
  })
  id!: string;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  requestedByUserId!: number | null;

  @Column({
    type: 'varchar',
    length: 10,
  })
  type!: PersonSyncBatchType;

  @Column({
    type: 'varchar',
    length: 20,
    default: PersonSyncBatchStatus.QUEUING,
  })
  status!: PersonSyncBatchStatus;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  terminalCount!: number;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  totalItems!: number;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  queuedItems!: number;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;
}
