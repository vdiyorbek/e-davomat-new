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

import { Textbook } from './textbook.entity';

// Mavzu qayerdan olingani
export enum TopicSource {
  GEMINI = 'GEMINI',
  MANUAL = 'MANUAL',
}

// Administrator tekshiruv holati
export enum TopicReviewStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('textbook_topics')
@Index('UQ_textbook_topics_textbook_order', ['textbookId', 'orderIndex'], {
  unique: true,
})
@Index('IDX_textbook_topics_textbook_review', ['textbookId', 'reviewStatus'])
export class TextbookTopic {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  // Qaysi PDF darslikka tegishli
  @Column({
    type: 'int',
    unsigned: true,
  })
  textbookId!: number;

  @ManyToOne(() => Textbook, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'textbookId',
    foreignKeyConstraintName: 'FK_textbook_topics_textbook',
  })
  textbook!: Textbook;

  // Mavzuning darslikdagi tartib raqami
  @Column({
    type: 'int',
    unsigned: true,
  })
  orderIndex!: number;

  // Bob nomi, masalan: Algebraik kasrlar
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  chapterTitle!: string | null;

  // Mavzu nomi
  @Column({
    type: 'varchar',
    length: 255,
  })
  title!: string;

  // Mavzuning PDF ichidagi birinchi sahifasi
  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  pageStart!: number | null;

  // Mavzuning PDF ichidagi oxirgi sahifasi
  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  pageEnd!: number | null;

  // Gemini yoki qo'lda kiritilgan
  @Column({
    type: 'enum',
    enum: TopicSource,
    default: TopicSource.GEMINI,
  })
  source!: TopicSource;

  // Administrator tasdiqlashi kerak
  @Column({
    type: 'enum',
    enum: TopicReviewStatus,
    default: TopicReviewStatus.PENDING_REVIEW,
  })
  reviewStatus!: TopicReviewStatus;

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
