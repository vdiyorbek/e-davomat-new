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
import { SchoolClass } from '../classes/school-class.entity';
import { User } from '../users/user.entity';
import { MembershipType } from '../school-memberships/school-membership.entity';

@Entity('attendance_weekly_schedules')
@Index('IDX_weekly_schedule_school_dates', [
  'schoolId',
  'effectiveFrom',
  'effectiveTo',
])
export class AttendanceWeeklySchedule {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  schoolId!: number;

  @ManyToOne(() => School, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'schoolId',
    foreignKeyConstraintName: 'FK_weekly_schedule_school',
  })
  school!: School;

  @Column({ type: 'varchar', length: 9 })
  academicYear!: string;

  @Column({
    type: 'enum',
    enum: MembershipType,
  })
  membershipType!: MembershipType;

  // Sinf darajasi oralig'i, masalan 1–4
  @Column({
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  gradeFrom!: number | null;

  @Column({
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  gradeTo!: number | null;

  // Alohida sinfga qoida berish uchun
  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  classId!: number | null;

  @ManyToOne(() => SchoolClass, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'classId',
    foreignKeyConstraintName: 'FK_weekly_schedule_class',
  })
  schoolClass!: SchoolClass | null;

  // Hafta kunlarining bitmask qiymati
  @Column({
    type: 'tinyint',
    unsigned: true,
  })
  workingDaysMask!: number;

  @Column({ type: 'date' })
  effectiveFrom!: string;

  @Column({
    type: 'date',
    nullable: true,
  })
  effectiveTo!: string | null;

  @Column({
    type: 'int',
    unsigned: true,
  })
  createdByUserId!: number;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'createdByUserId',
    foreignKeyConstraintName: 'FK_weekly_schedule_created_by',
  })
  createdBy!: User;

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
