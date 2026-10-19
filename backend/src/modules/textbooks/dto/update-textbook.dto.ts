import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimNullable = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateTextbookDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  subjectId?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 255)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['uz-Latn', 'uz-Cyrl', 'ru'])
  languageCode?: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 200)
  publisher?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  publicationYear?: number | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 300)
  approvalReference?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
