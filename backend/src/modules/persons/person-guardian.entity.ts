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

import { Person } from './person.entity';

export enum GuardianRelation {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
}

/** O‘quvchining ota-onasi: familiya, ism, otasining ismi va telefon raqami. */
@Entity('person_guardians')
@Index('UQ_person_guardians_person_relation', ['personId', 'relation'], {
  unique: true,
})
export class PersonGuardian {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  personId!: number;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_person_guardians_person',
  })
  person!: Person;

  @Column({ type: 'enum', enum: GuardianRelation })
  relation!: GuardianRelation;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middleName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber!: string | null;

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
