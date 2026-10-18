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

import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { Subject } from '../subjects/subject.entity';

@Entity('teacher_class_subjects')
@Index(
  'UQ_tcs_teacher_class_subject_start',
  ['teacherMembershipId', 'classId', 'subjectId', 'startDate'],
  { unique: true },
)
@Index('IDX_tcs_class_subject', ['classId', 'subjectId'])
@Index('IDX_tcs_teacher_membership', ['teacherMembershipId'])
export class TeacherClassSubject {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  // O'qituvchining maktabdagi TEACHER membership IDsi
  @Column({
    type: 'int',
    unsigned: true,
  })
  teacherMembershipId!: number;

  @ManyToOne(() => SchoolMembership, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'teacherMembershipId',
    foreignKeyConstraintName: 'FK_tcs_teacher_membership',
  })
  teacherMembership!: SchoolMembership;

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
    foreignKeyConstraintName: 'FK_tcs_school_class',
  })
  schoolClass!: SchoolClass;

  // O'qitiladigan fan
  @Column({
    type: 'int',
    unsigned: true,
  })
  subjectId!: number;

  @ManyToOne(() => Subject, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'subjectId',
    foreignKeyConstraintName: 'FK_tcs_subject',
  })
  subject!: Subject;

  // Biriktirish amal qilish davri
  @Column({
    type: 'date',
  })
  startDate!: string;

  // NULL - hali tugamagan
  // Tugash sanasi intervalga kirmaydi
  @Column({
    type: 'date',
    nullable: true,
  })
  endDate!: string | null;

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
