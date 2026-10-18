import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateTextbookTopicDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @Length(1, 255)
  title?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  chapterTitle?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageStart?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageEnd?: number | null;
}
