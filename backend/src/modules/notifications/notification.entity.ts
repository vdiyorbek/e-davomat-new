import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Tizim ichidagi bildirishnoma. Matn frontendda `type` va `payload` bo‘yicha tarjima qilinadi. */
@Entity('notifications')
@Index('UQ_notifications_user_dedupe', ['userId', 'dedupeKey'], {
  unique: true,
})
@Index('IDX_notifications_user_read', ['userId', 'readAt', 'id'])
export class Notification {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  /** Bir xil bildirishnoma takrorlanmasligi uchun (foydalanuvchi bo‘yicha noyob). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  dedupeKey!: string | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
