import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { InspectorDayStatus } from '../inspector.rules';

export const INSPECTOR_STATUS_FILTERS: readonly InspectorDayStatus[] = [
  'PRESENT',
  'EXCUSED',
  'ABSENT',
  'PENDING',
  'DAY_OFF',
];

export class GetInspectorStudentsQueryDto {
  /** Bo'sh bo'lsa, bugun (Toshkent vaqti). */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  /** Biriktirilgan mahallalardan birini tanlash. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mahallaId?: number;

  @IsOptional()
  @IsIn(INSPECTOR_STATUS_FILTERS)
  status?: InspectorDayStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
}
