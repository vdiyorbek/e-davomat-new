import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Assessment } from './assessment.entity';

@Entity('assessment_questions')
@Index('IDX_assessment_questions_order', ['assessmentId', 'orderIndex'])
export class AssessmentQuestion {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  assessmentId!: number;

  @ManyToOne(() => Assessment, (assessment) => assessment.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'assessmentId',
    foreignKeyConstraintName: 'FK_assessment_questions_assessment',
  })
  assessment!: Assessment;

  @Column({ type: 'smallint', unsigned: true })
  orderIndex!: number;

  @Column({ type: 'text' })
  text!: string;

  /** Har doim 4 ta variant (A, B, C, D). */
  @Column({ type: 'json' })
  options!: string[];

  @Column({ type: 'tinyint', unsigned: true })
  correctIndex!: number;

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  topicId!: number | null;
}
