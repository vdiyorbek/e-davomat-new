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

import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { User } from '../users/user.entity';

// Kun turi
export enum CalendarDayType {
  DAY_OFF = 'DAY_OFF',
  WORK_DAY = 'WORK_DAY',
}

// Kimlarga qo'llanadi
export enum CalendarAppliesTo {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  BOTH = 'BOTH',
}

// Qaysi hududga qo'llanadi
export enum CalendarScopeType {
  GLOBAL = 'GLOBAL',
  REGION = 'REGION',
  DISTRICT = 'DISTRICT',
  SCHOOL = 'SCHOOL',
}

@Entity('attendance_calendar_rules')
@Index('IDX_calendar_rules_scope_dates', [
  'scopeType',
  'startDate',
  'endDate',
  'isActive',
])
@Index('IDX_calendar_rules_region_dates', ['regionId', 'startDate', 'endDate'])
@Index('IDX_calendar_rules_district_dates', [
  'districtId',
  'startDate',
  'endDate',
])
@Index('IDX_calendar_rules_school_dates', ['schoolId', 'startDate', 'endDate'])
export class AttendanceCalendarRule {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'date',
  })
  startDate!: string;

  @Column({
    type: 'date',
  })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: CalendarDayType,
  })
  dayType!: CalendarDayType;

  @Column({
    type: 'enum',
    enum: CalendarAppliesTo,
    default: CalendarAppliesTo.BOTH,
  })
  appliesTo!: CalendarAppliesTo;

  @Column({
    type: 'enum',
    enum: CalendarScopeType,
  })
  scopeType!: CalendarScopeType;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  regionId!: number | null;

  @ManyToOne(() => Region, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'regionId',
    foreignKeyConstraintName: 'FK_calendar_rule_region',
  })
  region!: Region | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  districtId!: number | null;

  @ManyToOne(() => District, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'districtId',
    foreignKeyConstraintName: 'FK_calendar_rule_district',
  })
  district!: District | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  schoolId!: number | null;

  @ManyToOne(() => School, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'schoolId',
    foreignKeyConstraintName: 'FK_calendar_rule_school',
  })
  school!: School | null;

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
    foreignKeyConstraintName: 'FK_calendar_rule_class',
  })
  schoolClass!: SchoolClass | null;

  // Yuqori darajadagi majburiy qoida
  @Column({
    type: 'boolean',
    default: false,
  })
  isMandatory!: boolean;

  // Sabab: bayram, ta'til va hokazo
  @Column({
    type: 'varchar',
    length: 500,
  })
  reason!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    type: 'int',
    unsigned: true,
  })
  createdByUserId!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'createdByUserId',
    foreignKeyConstraintName: 'FK_calendar_rule_created_by',
  })
  createdBy!: User;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  updatedByUserId!: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'updatedByUserId',
    foreignKeyConstraintName: 'FK_calendar_rule_updated_by',
  })
  updatedBy!: User | null;

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
