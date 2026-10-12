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

import { School } from '../schools/school.entity';

@Entity('school_classes')
@Index(
  'UQ_school_classes_school_year_name',
  ['schoolId', 'academicYear', 'name'],
  { unique: true },
)
export class SchoolClass {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

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
    foreignKeyConstraintName: 'FK_school_classes_school',
  })
  school!: School;

  // Masalan: 2026-2027
  @Column({
    type: 'varchar',
    length: 9,
  })
  academicYear!: string;

  // Masalan: 2A, 3B, 11A
  @Column({
    type: 'varchar',
    length: 30,
  })
  name!: string;

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
