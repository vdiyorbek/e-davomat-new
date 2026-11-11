import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** '1'…'12' — aniq daraja, 'NONE' — darajasi belgilanmaganlar. */
export const CLASS_GRADE_FILTERS = [
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
  'NONE',
];

export class GetClassesPageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{3}-[1-9][0-9]{3}$/, {
    message: 'O‘quv yili 2026-2027 formatida bo‘lishi kerak',
  })
  academicYear?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  regionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  districtId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId?: number;

  @IsOptional()
  @IsIn(CLASS_GRADE_FILTERS, {
    message: 'grade 1–12 yoki NONE bo‘lishi kerak',
  })
  grade?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MaxLength(100, {
    message: 'Qidiruv matni 100 ta belgidan oshmasligi kerak',
  })
  q?: string;
}
