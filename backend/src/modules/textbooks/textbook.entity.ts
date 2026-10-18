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

import { Subject } from '../subjects/subject.entity';

export enum TextbookProcessingStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('textbooks')
@Index('IDX_textbooks_subject_grade_language', [
  'subjectId',
  'gradeLevel',
  'languageCode',
])
export class Textbook {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  // Darslik qaysi fanga tegishli
  @Column({
    type: 'int',
    unsigned: true,
  })
  subjectId!: number;

  @ManyToOne(() => Subject, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'subjectId',
    foreignKeyConstraintName: 'FK_textbooks_subject',
  })
  subject!: Subject;

  // 1-12-sinf darajasi
  @Column({
    type: 'tinyint',
    unsigned: true,
  })
  gradeLevel!: number;

  @Column({
    type: 'varchar',
    length: 255,
  })
  title!: string;

  // Masalan: uz-Latn, uz-Cyrl, ru
  @Column({
    type: 'varchar',
    length: 12,
  })
  languageCode!: string;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  publisher!: string | null;

  @Column({
    type: 'smallint',
    unsigned: true,
    nullable: true,
  })
  publicationYear!: number | null;

  // Rasmiy tasdiqlash hujjatining rekvizitlari
  @Column({
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  approvalReference!: string | null;

  // Administrator tasdiqlash ma'lumotlarini tekshirganmi?
  @Column({
    type: 'boolean',
    default: false,
  })
  isVerified!: boolean;

  // PDF serverdagi yopiq saqlash manzili
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  fileStorageKey!: string | null;

  // Fayl yaxlitligini tekshirish uchun SHA-256
  @Column({
    type: 'char',
    length: 64,
    nullable: true,
  })
  fileSha256!: string | null;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  pageCount!: number | null;

  @Column({
    type: 'enum',
    enum: TextbookProcessingStatus,
    default: TextbookProcessingStatus.DRAFT,
  })
  processingStatus!: TextbookProcessingStatus;

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
