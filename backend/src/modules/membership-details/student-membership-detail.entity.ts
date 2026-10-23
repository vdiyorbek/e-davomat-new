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

@Entity('student_membership_details')
@Index('UQ_student_membership_details_membership', ['membershipId'], {
  unique: true,
})
export class StudentMembershipDetail {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'int',
    unsigned: true,
  })
  membershipId!: number;

  @ManyToOne(() => SchoolMembership, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'membershipId',
    foreignKeyConstraintName: 'FK_student_membership_details_membership',
  })
  membership!: SchoolMembership;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  studentNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  admissionOrderNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  educationLanguage!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  educationForm!: string | null;

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
