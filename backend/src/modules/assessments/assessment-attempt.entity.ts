import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Person } from '../persons/person.entity';
import { Assessment } from './assessment.entity';

/** Savol ID → tanlangan variant indeksi. */
export type AttemptAnswers = Record<string, number>;

@Entity('assessment_attempts')
@Index('UQ_assessment_attempts_person', ['assessmentId', 'personId'], {
  unique: true,
})
export class AssessmentAttempt {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  assessmentId!: number;

  @ManyToOne(() => Assessment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'assessmentId',
    foreignKeyConstraintName: 'FK_assessment_attempts_assessment',
  })
  assessment!: Assessment;

  @Column({ type: 'int', unsigned: true })
  personId!: number;

  @ManyToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_assessment_attempts_person',
  })
  person!: Person;

  @Column({ type: 'datetime', precision: 3 })
  startedAt!: Date;

  @Column({ type: 'datetime', precision: 3 })
  deadlineAt!: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'json', nullable: true })
  answers!: AttemptAnswers | null;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  correctCount!: number | null;

  @Column({ type: 'smallint', unsigned: true })
  totalCount!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  percent!: number | null;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  grade!: number | null;
}
