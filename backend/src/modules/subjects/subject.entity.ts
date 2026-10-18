import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('curriculum_subjects')
@Index('UQ_curriculum_subjects_code', ['code'], {
  unique: true,
})
export class Subject {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 40,
  })
  code!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  nameUz!: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  nameRu!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

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
