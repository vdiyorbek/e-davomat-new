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

import { SchoolClass } from '../classes/school-class.entity';

import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';

@Entity('lesson_schedules')
@Index('IDX_lesson_schedules_class_day', ['classId', 'dayOfWeek'])
@Index('IDX_lesson_schedules_teacher_assignment', ['teacherAssignmentId'])
export class LessonSchedule {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  // Dars o'tiladigan sinf
  @Column({
    type: 'int',
    unsigned: true,
  })
  classId!: number;

  @ManyToOne(() => SchoolClass, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'classId',
    foreignKeyConstraintName: 'FK_lesson_schedules_class',
  })
  schoolClass!: SchoolClass;

  // O'qituvchi + fan + sinf biriktirmasi
  @Column({
    type: 'int',
    unsigned: true,
  })
  teacherAssignmentId!: number;

  @ManyToOne(() => TeacherClassSubject, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'teacherAssignmentId',
    foreignKeyConstraintName: 'FK_lesson_schedules_assignment',
  })
  teacherAssignment!: TeacherClassSubject;

  // 1 - Dushanba, 6 - Shanba
  @Column({
    type: 'tinyint',
    unsigned: true,
  })
  dayOfWeek!: number;

  // 1-dars, 2-dars va hokazo
  @Column({
    type: 'tinyint',
    unsigned: true,
  })
  lessonNumber!: number;

  @Column({
    type: 'time',
  })
  startTime!: string;

  @Column({
    type: 'time',
  })
  endTime!: string;

  // Jadval amal qilishining birinchi kuni
  @Column({
    type: 'date',
  })
  startDate!: string;

  // NULL - muddatsiz
  // Tugash sanasi intervalga kirmaydi
  @Column({
    type: 'date',
    nullable: true,
  })
  endDate!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

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
