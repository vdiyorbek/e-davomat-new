import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Mahalla } from '../mahallas/mahalla.entity';
import { User } from '../users/user.entity';

@Entity('inspector_mahallas')
@Index('UQ_inspector_mahallas', ['userId', 'mahallaId'], { unique: true })
@Index('IDX_inspector_mahallas_mahalla', ['mahallaId'])
export class InspectorMahalla {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_inspector_mahallas_user',
  })
  user!: User;

  @Column({ type: 'int', unsigned: true })
  mahallaId!: number;

  @ManyToOne(() => Mahalla, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'mahallaId',
    foreignKeyConstraintName: 'FK_inspector_mahallas_mahalla',
  })
  mahalla!: Mahalla;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
