import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TerminalStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/**
 * Terminal holati davri: «14:02 dan 14:36 gacha OFFLINE».
 * Har tekshiruv emas, faqat holat o‘zgarganda yangi qator yoziladi.
 * `endedAt = NULL` — davr hali davom etmoqda (har terminalda ko‘pi bilan bitta).
 */
@Entity('terminal_status_periods')
@Index('IDX_terminal_status_periods_terminal_started', [
  'terminalId',
  'startedAt',
])
@Index('IDX_terminal_status_periods_terminal_open', ['terminalId', 'endedAt'])
export class TerminalStatusPeriod {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'int', unsigned: true })
  terminalId!: number;

  @Column({ type: 'enum', enum: TerminalStatus })
  status!: TerminalStatus;

  @Column({ type: 'datetime', precision: 3 })
  startedAt!: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  endedAt!: Date | null;

  /** Shu davrdagi oxirgi tekshiruv vaqti (bo‘shliqlarni aniqlash uchun). */
  @Column({ type: 'datetime', precision: 3 })
  lastCheckAt!: Date;

  @Column({ type: 'int', unsigned: true, default: 1 })
  checks!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  failedChecks!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastError!: string | null;
}
