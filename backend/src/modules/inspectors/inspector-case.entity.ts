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
import { User } from '../users/user.entity';

export enum InspectorCaseStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/** Uchastkavoy kim bilan gaplashgan. */
export enum CaseContact {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  GUARDIAN = 'GUARDIAN',
  STUDENT = 'STUDENT',
  NEIGHBOR = 'NEIGHBOR',
  NOT_MET = 'NOT_MET',
}

/** Darsga kelmaslikning aniqlangan sababi. */
export enum CaseReason {
  ILLNESS = 'ILLNESS',
  FAMILY = 'FAMILY',
  MIGRATED = 'MIGRATED',
  WORKING = 'WORKING',
  NO_INTEREST = 'NO_INTEREST',
  NOT_FOUND = 'NOT_FOUND',
  OTHER = 'OTHER',
}

/** O'rganish natijasi. */
export enum CaseOutcome {
  RETURNED = 'RETURNED',
  EXCUSED = 'EXCUSED',
  REFERRED = 'REFERRED',
  TRANSFERRED = 'TRANSFERRED',
  STILL_ABSENT = 'STILL_ABSENT',
}

/**
 * Ketma-ket 5+ o‘quv kuni kelmagan o‘quvchi bo‘yicha uchastkavoyning
 * o‘rganish ishi. Bitta o‘quvchida bir vaqtda bitta ochiq ish bo‘ladi.
 */
@Entity('inspector_cases')
@Index('IDX_inspector_cases_inspector', ['inspectorUserId', 'status'])
@Index('IDX_inspector_cases_person', ['personId', 'status'])
export class InspectorCase {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  inspectorUserId!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'inspectorUserId',
    foreignKeyConstraintName: 'FK_inspector_cases_user',
  })
  inspector!: User;

  @Column({ type: 'int', unsigned: true })
  personId!: number;

  @ManyToOne(() => Person, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_inspector_cases_person',
  })
  person!: Person;

  @Column({ type: 'int', unsigned: true })
  schoolId!: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  classId!: number | null;

  /** Ish ochilgan paytdagi kelmaslik boshlangan sana va ketma-ket kunlar. */
  @Column({ type: 'date' })
  absentSince!: string;

  @Column({ type: 'smallint', unsigned: true })
  absentDays!: number;

  @Column({
    type: 'enum',
    enum: InspectorCaseStatus,
    default: InspectorCaseStatus.OPEN,
  })
  status!: InspectorCaseStatus;

  @Column({ type: 'date', nullable: true })
  visitDate!: string | null;

  @Column({ type: 'enum', enum: CaseContact, nullable: true })
  spokeWith!: CaseContact | null;

  @Column({ type: 'enum', enum: CaseReason, nullable: true })
  reason!: CaseReason | null;

  @Column({ type: 'text', nullable: true })
  findings!: string | null;

  @Column({ type: 'text', nullable: true })
  actionsTaken!: string | null;

  @Column({ type: 'enum', enum: CaseOutcome, nullable: true })
  outcome!: CaseOutcome | null;

  @Column({ type: 'date', nullable: true })
  followUpDate!: string | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  closedAt!: Date | null;

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
