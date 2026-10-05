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
import { User } from '../users/user.entity';

@Entity('auth_sessions')
@Index('IDX_auth_sessions_user', ['userId'])
@Index('IDX_auth_sessions_expires', ['expiresAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'int',
    unsigned: true,
  })
  userId!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_auth_sessions_user',
  })
  user!: User;

  @Column({
    type: 'char',
    length: 64,
    select: false,
  })
  refreshTokenHash!: string;

  @Column({
    type: 'datetime',
    precision: 3,
  })
  expiresAt!: Date;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  revokedAt!: Date | null;

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
