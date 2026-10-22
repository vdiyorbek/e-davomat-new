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

import { LessonSchedule } from '../lesson-schedules/lesson-schedule.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import { TextbookTopic } from '../textbooks/textbook-topic.entity';

export enum LessonSessionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('lesson_sessions')
@Index('UQ_lesson_sessions_schedule_date', ['lessonScheduleId', 'lessonDate'], {
  unique: true,
})
@Index('IDX_lesson_sessions_class_date', ['classId', 'lessonDate'])
@Index('IDX_lesson_sessions_assignment_date', [
  'teacherAssignmentId',
  'lessonDate',
])
export class LessonSession {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  // Haftalik jadvalning aynan qaysi versiyasi
  @Column({
    type: 'int',
    unsigned: true,
  })
  lessonScheduleId!: number;

  @ManyToOne(() => LessonSchedule, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'lessonScheduleId',
    foreignKeyConstraintName: 'FK_lesson_sessions_schedule',
  })
  lessonSchedule!: LessonSchedule;

  // Dars o‘tiladigan haqiqiy sana
  @Column({
    type: 'date',
  })
  lessonDate!: string;

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
    foreignKeyConstraintName: 'FK_lesson_sessions_class',
  })
  schoolClass!: SchoolClass;

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
    foreignKeyConstraintName: 'FK_lesson_sessions_assignment',
  })
  teacherAssignment!: TeacherClassSubject;

  // Jadval o‘zgarsa ham darsning vaqti saqlanadi
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

  // Darslikdagi mavzu (ixtiyoriy)
  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  textbookTopicId!: number | null;

  @ManyToOne(() => TextbookTopic, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'textbookTopicId',
    foreignKeyConstraintName: 'FK_lesson_sessions_textbook_topic',
  })
  textbookTopic!: TextbookTopic | null;

  // Mavzu nomining tarixiy nusxasi
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  topicTitle!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  homework!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  teacherNotes!: string | null;

  @Column({
    type: 'enum',
    enum: LessonSessionStatus,
    default: LessonSessionStatus.PLANNED,
  })
  status!: LessonSessionStatus;

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
