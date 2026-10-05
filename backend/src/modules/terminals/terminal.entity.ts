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

import { School } from 'src/modules/schools/school.entity';
import { TerminalDirection } from './enums/terminal-direction.enum';
import { TerminalProtocol } from './enums/terminal-protocol.enum';

@Entity('terminals')
@Index('UQ_terminals_host_port', ['host', 'port'], {
  unique: true,
})
@Index('IDX_terminals_school_active', ['schoolId', 'isActive'])
export class Terminal {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'varchar',
    length: 150,
  })
  name!: string;

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
    foreignKeyConstraintName: 'FK_terminals_school',
  })
  school!: School;

  @Column({
    type: 'enum',
    enum: TerminalDirection,
  })
  direction!: TerminalDirection;

  @Column({
    type: 'enum',
    enum: TerminalProtocol,
    default: TerminalProtocol.HTTP,
  })
  protocol!: TerminalProtocol;

  @Column({
    type: 'varchar',
    length: 253,
  })
  host!: string;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 80,
  })
  port!: number;

  @Column({
    type: 'varchar',
    length: 100,
  })
  username!: string;

  @Column({
    type: 'text',
    select: false,
  })
  passwordEncrypted!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  model!: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  serialNumber!: string | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastCheckedAt!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastSuccessfulSyncAt!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  syncStartAt!: Date | null;

  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  eventsSyncedUntil!: Date | null;

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
