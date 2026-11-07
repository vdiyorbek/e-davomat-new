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
import { User } from '../users/user.entity';

export enum TalkSpokeWith {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  GUARDIAN = 'GUARDIAN',
  STUDENT = 'STUDENT',
}

export enum TalkResult {
  SOLVED = 'SOLVED',
  RECHECK = 'RECHECK',
  REFERRED = 'REFERRED',
}

@Entity('inspector_talks')
@Index('IDX_inspector_talks_person', ['personId', 'talkDate'])
@Index('IDX_inspector_talks_inspector', ['inspectorUserId', 'talkDate'])
export class InspectorTalk {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  inspectorUserId!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'inspectorUserId',
    foreignKeyConstraintName: 'FK_inspector_talks_user',
  })
  inspector!: User;

  @Column({ type: 'int', unsigned: true })
  personId!: number;

  @ManyToOne(() => Person, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_inspector_talks_person',
  })
  person!: Person;

  @Column({ type: 'date' })
  talkDate!: string;

  @Column({ type: 'enum', enum: TalkSpokeWith })
  spokeWith!: TalkSpokeWith;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ type: 'enum', enum: TalkResult })
  result!: TalkResult;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'date', nullable: true })
  followUpDate!: string | null;

  // PDF ochiq havola orqali berilmaydi.
  @Column({ type: 'varchar', length: 255, select: false })
  pdfPath!: string;

  @Column({ type: 'varchar', length: 255 })
  pdfOriginalName!: string;

  @Column({ type: 'int', unsigned: true })
  pdfSize!: number;

  @Column({ type: 'char', length: 64, select: false })
  pdfSha256!: string;

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
