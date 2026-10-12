import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Person } from '../persons/person.entity';
import { UserRole } from './enums/user-role.enum';
import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';

@Entity('users')
@Index('UQ_users_person', ['personId'], { unique: true })
@Index('UQ_users_login', ['login'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  login!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  firstName!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastName!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  middleName!: string | null;

  @Column({
    type: 'int',
    unsigned: true,
  })
  personId!: number;

  @OneToOne(() => Person, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_users_person',
  })
  person!: Person;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  regionId!: number | null;

  @ManyToOne(() => Region, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'regionId',
    foreignKeyConstraintName: 'FK_users_region',
  })
  region!: Region | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  districtId!: number | null;

  @ManyToOne(() => District, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'districtId',
    foreignKeyConstraintName: 'FK_users_district',
  })
  district!: District | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  schoolId!: number | null;

  @ManyToOne(() => School, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'schoolId',
    foreignKeyConstraintName: 'FK_users_school',
  })
  school!: School | null;

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
