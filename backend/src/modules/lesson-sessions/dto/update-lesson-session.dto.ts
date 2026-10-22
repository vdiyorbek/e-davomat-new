import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { LessonSessionStatus } from '../lesson-session.entity';

export class UpdateLessonSessionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  textbookTopicId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topicTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  homework?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  teacherNotes?: string | null;

  @IsOptional()
  @IsEnum(LessonSessionStatus)
  status?: LessonSessionStatus;
}
