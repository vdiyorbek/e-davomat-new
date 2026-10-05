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

import { School } from '../schools/school.entity';
import { Terminal } from '../terminals/terminal.entity';
import { TerminalDirection } from '../terminals/enums/terminal-direction.enum';
import { EventPhotoStatus } from './enums/event-photo-status.enum';

@Entity('attendance_events')
@Index(
  'UQ_attendance_events_terminal_serial_time',
  ['terminalId', 'serialNo', 'eventAt'],
  { unique: true },
)
@Index('IDX_attendance_events_school_person_time', [
  'schoolId',
  'pnfl',
  'eventAt',
])
@Index('IDX_attendance_events_school_time', ['schoolId', 'eventAt'])
export class AttendanceEvent {
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
    foreignKeyConstraintName: 'FK_attendance_events_terminal',
  })
  terminal!: Terminal;

  @Column({
    type: 'int',
    unsigned: true,
  })
  schoolId!: number;

  @ManyToOne(() => School, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'schoolId',
    foreignKeyConstraintName: 'FK_attendance_events_school',
  })
  school!: School;

  @Column({
    type: 'varchar',
    length: 14,
  })
  pnfl!: string;

  @Column({
    type: 'bigint',
    unsigned: true,
  })
  serialNo!: string;

  @Column({
    type: 'datetime',
    precision: 3,
  })
  eventAt!: Date;

  @Column({
    type: 'enum',
    enum: TerminalDirection,
  })
  direction!: TerminalDirection;

  @Column({
    type: 'int',
    unsigned: true,
  })
  major!: number;

  @Column({
    type: 'int',
    unsigned: true,
  })
  minor!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  verifyMode!: string | null;

  @Column({
    type: 'text',
    nullable: true,
    select: false,
  })
  sourcePictureUrl!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  photoPath!: string | null;

  @Column({
    type: 'enum',
    enum: EventPhotoStatus,
    default: EventPhotoStatus.PENDING,
  })
  photoStatus!: EventPhotoStatus;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  photoAttempts!: number;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  photoLastAttemptAt!: Date | null;

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
