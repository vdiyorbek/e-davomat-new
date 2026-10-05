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
import { District } from '../districts/district.entity';
import { Region } from '../regions/region.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';

@Entity('daily_attendance')
@Index('UQ_daily_attendance_school_person_date', ['schoolId', 'pnfl', 'date'], {
  unique: true,
})
@Index('IDX_daily_attendance_school_date', ['schoolId', 'date'])
@Index('IDX_daily_attendance_district_date', ['districtId', 'date'])
@Index('IDX_daily_attendance_region_date', ['regionId', 'date'])
export class DailyAttendance {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
  })
  id!: string;

  @Column({
    type: 'date',
  })
  date!: string;

  @Column({
    type: 'varchar',
    length: 14,
  })
  pnfl!: string;

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
    foreignKeyConstraintName: 'FK_daily_attendance_school',
  })
  school!: School;

  @Column({
    type: 'int',
    unsigned: true,
  })
  districtId!: number;

  @ManyToOne(() => District, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'districtId',
    foreignKeyConstraintName: 'FK_daily_attendance_district',
  })
  district!: District;

  @Column({
    type: 'int',
    unsigned: true,
  })
  regionId!: number;

  @ManyToOne(() => Region, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'regionId',
    foreignKeyConstraintName: 'FK_daily_attendance_region',
  })
  region!: Region;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  firstInTime!: Date | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  firstInEventId!: string | null;

  @ManyToOne(() => AttendanceEvent, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'firstInEventId',
    foreignKeyConstraintName: 'FK_daily_attendance_first_in',
  })
  firstInEvent!: AttendanceEvent | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastOutTime!: Date | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  lastOutEventId!: string | null;

  @ManyToOne(() => AttendanceEvent, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'lastOutEventId',
    foreignKeyConstraintName: 'FK_daily_attendance_last_out',
  })
  lastOutEvent!: AttendanceEvent | null;

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
