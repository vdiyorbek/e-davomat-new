import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PersonSyncBatchItemStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
  UNCERTAIN = 'UNCERTAIN',
}

@Entity('person_sync_batch_items')
@Index(
  'UQ_ps_item_batch_terminal_person',
  ['batchId', 'terminalId', 'personId'],
  { unique: true },
)
@Index('IDX_ps_item_batch_status', ['batchId', 'status'])
@Index('IDX_ps_item_terminal_date', ['terminalId', 'createdAt'])
@Index('IDX_ps_item_job', ['jobId'])
export class PersonSyncBatchItem {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
  })
  id!: string;

  @Column({
    type: 'bigint',
    unsigned: true,
  })
  batchId!: string;

  @Column({
    type: 'int',
    unsigned: true,
  })
  terminalId!: number;

  @Column({
    type: 'int',
    unsigned: true,
  })
  personId!: number;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  jobId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: PersonSyncBatchItemStatus.PENDING,
  })
  status!: PersonSyncBatchItemStatus;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  attempts!: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  errorCode!: string | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  startedAt!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;
}
