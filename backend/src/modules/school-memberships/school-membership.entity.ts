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
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';

export enum MembershipType {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

@Entity('school_memberships')
@Index(
  'UQ_memberships_person_school_type_start',
  ['personId', 'schoolId', 'type', 'startDate'],
  { unique: true },
)
@Index('IDX_memberships_school_type', ['schoolId', 'type'])
export class SchoolMembership {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'int',
    unsigned: true,
  })
  personId!: number;

  @ManyToOne(() => Person, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_memberships_person',
  })
  person!: Person;

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
    foreignKeyConstraintName: 'FK_memberships_school',
  })
  school!: School;

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
    foreignKeyConstraintName: 'FK_memberships_class',
  })
  schoolClass!: SchoolClass | null;

  @Column({
    type: 'enum',
    enum: MembershipType,
  })
  type!: MembershipType;

  @Column({
    type: 'date',
  })
  startDate!: string;

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
