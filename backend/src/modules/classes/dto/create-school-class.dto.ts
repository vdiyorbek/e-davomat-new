import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateSchoolClassDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsString()
  @Matches(/^[1-9][0-9]{3}-[1-9][0-9]{3}$/, {
    message: 'O‘quv yili 2026-2027 formatida bo‘lishi kerak',
  })
  academicYear!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').toUpperCase()
      : value,
  )
  @IsString()
  @Length(1, 30, {
    message: 'Sinf nomi 1–30 belgidan iborat bo‘lishi kerak',
  })
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel?: number;
}
