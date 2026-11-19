import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SchoolClass } from '../classes/school-class.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import { AssessmentQuestion } from './assessment-question.entity';

/** CHSB — choraklik summativ baholash, BSB — bo‘lim bo‘yicha summativ baholash. */
export enum AssessmentType {
  CHSB = 'CHSB',
  BSB = 'BSB',
}

export enum AssessmentStatus {
  GENERATING = 'GENERATING',
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  FAILED = 'FAILED',
}

export enum AssessmentDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

@Entity('assessments')
@Index('IDX_assessments_assignment', ['teacherAssignmentId', 'createdAt'])
@Index('IDX_assessments_class_status', ['classId', 'status'])
export class Assessment {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  teacherAssignmentId!: number;

  @ManyToOne(() => TeacherClassSubject, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'teacherAssignmentId',
    foreignKeyConstraintName: 'FK_assessments_assignment',
  })
  teacherAssignment!: TeacherClassSubject;

  @Column({ type: 'int', unsigned: true })
  schoolId!: number;

  @Column({ type: 'int', unsigned: true })
  classId!: number;

  @ManyToOne(() => SchoolClass, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'classId',
    foreignKeyConstraintName: 'FK_assessments_class',
  })
  schoolClass!: SchoolClass;

  @Column({ type: 'int', unsigned: true })
  subjectId!: number;

  @Column({ type: 'enum', enum: AssessmentType })
  type!: AssessmentType;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  quarter!: number | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({
    type: 'enum',
    enum: AssessmentStatus,
    default: AssessmentStatus.GENERATING,
  })
  status!: AssessmentStatus;

  @Column({ type: 'json' })
  topicIds!: number[];

  @Column({ type: 'tinyint', unsigned: true })
  questionCount!: number;

  @Column({
    type: 'enum',
    enum: AssessmentDifficulty,
    default: AssessmentDifficulty.MEDIUM,
  })
  difficulty!: AssessmentDifficulty;

  @Column({ type: 'smallint', unsigned: true, default: 40 })
  durationMinutes!: number;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  aiModel!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  generationError!: string | null;

  @Column({ type: 'int', unsigned: true })
  createdByUserId!: number;

  @OneToMany(() => AssessmentQuestion, (question) => question.assessment)
  questions!: AssessmentQuestion[];

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
