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

import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { User } from '../users/user.entity';

export enum AttendanceExcuseReason {
  ILLNESS = 'ILLNESS',
  OLYMPIAD = 'OLYMPIAD',
  FAMILY = 'FAMILY',
  OTHER = 'OTHER',
}

export enum AttendanceExcuseStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('attendance_excuses')
@Index('IDX_excuses_school_status_dates', [
  'schoolId',
  'status',
  'startDate',
  'endDate',
])
@Index('IDX_excuses_person_dates', ['personId', 'startDate', 'endDate'])
export class AttendanceExcuse {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  personId!: number;

  @ManyToOne(() => Person, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_excuses_person',
  })
  person!: Person;

  @Column({ type: 'int', unsigned: true })
  schoolId!: number;

  @ManyToOne(() => School, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'schoolId',
    foreignKeyConstraintName: 'FK_excuses_school',
  })
  school!: School;

  @Column({
    type: 'enum',
    enum: AttendanceExcuseReason,
  })
  reason!: AttendanceExcuseReason;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  reasonNote!: string | null;

  // Ikkala sana ham sababli davrga kiradi.
  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: AttendanceExcuseStatus,
    default: AttendanceExcuseStatus.ACTIVE,
  })
  status!: AttendanceExcuseStatus;

  // PDF ochiq havola orqali berilmaydi.
  @Column({
    type: 'varchar',
    length: 500,
    select: false,
  })
  pdfPath!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  pdfOriginalName!: string;

  @Column({
    type: 'int',
    unsigned: true,
  })
  pdfSize!: number;

  @Column({
    type: 'char',
    length: 64,
    select: false,
  })
  pdfSha256!: string;

  // Arizani kim yuklagan?
  @Column({ type: 'int', unsigned: true })
  uploadedByUserId!: number;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'uploadedByUserId',
    foreignKeyConstraintName: 'FK_excuses_uploaded_by',
  })
  uploadedBy!: User;

  // Ariza bekor qilinganda.
  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  cancelledByUserId!: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'cancelledByUserId',
    foreignKeyConstraintName: 'FK_excuses_cancelled_by',
  })
  cancelledBy!: User | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  cancelledAt!: Date | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancellationReason!: string | null;

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
