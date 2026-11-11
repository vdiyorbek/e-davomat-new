import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Terminal } from './terminal.entity';
import { Person } from '../persons/person.entity';
import { PersonSyncStatus } from './enums/person-sync-status.enum';

@Entity('terminal_person_sync')
@Index('UQ_terminal_person_sync_terminal_person', ['terminalId', 'personId'], {
  unique: true,
})
@Index('IDX_terminal_person_sync_status', ['status', 'updatedAt'])
export class TerminalPersonSync {
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
    foreignKeyConstraintName: 'FK_terminal_person_sync_terminal',
  })
  terminal!: Terminal;

  @Column({
    type: 'int',
    unsigned: true,
  })
  personId!: number;

  @ManyToOne(() => Person, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_terminal_person_sync_person',
  })
  person!: Person;

  @Column({
    type: 'enum',
    enum: PersonSyncStatus,
    default: PersonSyncStatus.PENDING,
  })
  status!: PersonSyncStatus;

  @Column({
    type: 'boolean',
    default: false,
  })
  userCreated!: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  faceUploaded!: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  verified!: boolean;

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
  lastAttemptAt!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  verifiedAt!: Date | null;

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
