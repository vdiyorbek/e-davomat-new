import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UploadTextbookDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;

  @IsString()
  @Length(2, 255)
  title!: string;

  @IsIn(['uz-Latn', 'uz-Cyrl', 'ru'])
  languageCode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  publisher?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  publicationYear?: number;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  approvalReference?: string;
}
