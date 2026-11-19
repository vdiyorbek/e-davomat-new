import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { AssessmentDifficulty, AssessmentType } from '../assessment.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateAssessmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId!: number;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  /** CHSB uchun majburiy. */
  @ValidateIf(
    (dto: CreateAssessmentDto) =>
      dto.type === AssessmentType.CHSB || dto.quarter != null,
  )
  @Type(() => Number)
  @IsInt({ message: 'CHSB uchun chorakni (1–4) tanlang' })
  @Min(1, { message: 'CHSB uchun chorakni (1–4) tanlang' })
  @Max(4, { message: 'CHSB uchun chorakni (1–4) tanlang' })
  quarter?: number | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta mavzu tanlang' })
  @ArrayMaxSize(60)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  topicIds!: number[];

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(40)
  questionCount!: number;

  @IsEnum(AssessmentDifficulty)
  difficulty!: AssessmentDifficulty;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(180)
  durationMinutes!: number;
}
