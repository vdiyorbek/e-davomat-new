import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { LessonSessionStatus } from '../../lesson-sessions/lesson-session.entity';

export class UpdateTeacherSessionDto {
  @IsOptional()
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
