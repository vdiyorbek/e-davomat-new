import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  CalendarAppliesTo,
  CalendarDayType,
  CalendarScopeType,
} from '../attendance-calendar-rule.entity';

export class CreateCalendarRuleDto {
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;

  @IsEnum(CalendarDayType)
  dayType!: CalendarDayType;

  @IsEnum(CalendarAppliesTo)
  appliesTo!: CalendarAppliesTo;

  @IsEnum(CalendarScopeType)
  scopeType!: CalendarScopeType;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason!: string;
}
