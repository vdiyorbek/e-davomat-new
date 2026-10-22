import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Person } from '../persons/person.entity';

@Entity('user_person_links')
@Index('UQ_user_person_links_user', ['userId'], {
  unique: true,
})
@Index('UQ_user_person_links_person', ['personId'], {
  unique: true,
})
export class UserPersonLink {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    type: 'int',
    unsigned: true,
  })
  userId!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_person_links_user',
  })
  user!: User;

  @Column({
    type: 'int',
    unsigned: true,
  })
  personId!: number;

  @ManyToOne(() => Person, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'personId',
    foreignKeyConstraintName: 'FK_user_person_links_person',
  })
  person!: Person;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
