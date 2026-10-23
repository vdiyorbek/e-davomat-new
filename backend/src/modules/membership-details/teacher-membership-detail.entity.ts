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

@Entity('teacher_membership_details')
@Index('UQ_teacher_membership_details_membership', ['membershipId'], {
  unique: true,
})
export class TeacherMembershipDetail {
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
    foreignKeyConstraintName: 'FK_teacher_membership_details_membership',
  })
  membership!: SchoolMembership;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  employeeNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  position!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  employmentType!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  qualificationCategory!: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  specialization!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  educationLevel!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  hireOrderNumber!: string | null;

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
