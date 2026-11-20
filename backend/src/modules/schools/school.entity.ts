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
import { District } from '../districts/district.entity';

@Entity('schools')
@Index('UQ_schools_district_name', ['districtId', 'name'], {
  unique: true,
})
export class School {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 200,
  })
  name!: string;

  @Column({
    type: 'int',
    unsigned: true,
  })
  districtId!: number;

  @ManyToOne(() => District, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'districtId',
    foreignKeyConstraintName: 'FK_schools_district',
  })
  district!: District;

  /** Maktab lokatsiyasi (xaritada ko‘rsatish uchun). */
  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value ?? null,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  latitude!: number | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value ?? null,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  longitude!: number | null;

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
