import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Mahalla } from '../mahallas/mahalla.entity';

export enum PersonGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

@Entity('persons')
@Index('UQ_persons_pnfl', ['pnfl'], { unique: true })
export class Person {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 14,
  })
  pnfl!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  firstName!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  lastName!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  middleName!: string | null;

  @Column({
    type: 'enum',
    enum: PersonGender,
    nullable: true,
  })
  gender!: PersonGender | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  nationality!: string | null;

  @Column({
    type: 'date',
    nullable: true,
  })
  birthDate!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  address!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  phoneNumber!: string | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  mahallaId!: number | null;

  @ManyToOne(() => Mahalla, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'mahallaId',
    foreignKeyConstraintName: 'FK_persons_mahalla',
  })
  mahalla!: Mahalla | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  photoUrl!: string | null;

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

  @DeleteDateColumn({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}
