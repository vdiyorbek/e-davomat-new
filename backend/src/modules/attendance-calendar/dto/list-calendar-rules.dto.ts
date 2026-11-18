import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  CalendarAppliesTo,
  CalendarDayType,
  CalendarScopeType,
} from '../attendance-calendar-rule.entity';

/** Dam olish va bayram kunlari ro‘yxati (barcha hududlar bo‘yicha). */
export class ListCalendarRulesDto {
  /** Kalendar yili (1-yanvar — 31-dekabr). Berilmasa — joriy yil. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** STUDENT tanlansa, «hammasi uchun» (BOTH) qoidalar ham chiqadi. */
  @IsOptional()
  @IsEnum(CalendarAppliesTo)
  appliesTo?: CalendarAppliesTo;

  @IsOptional()
  @IsEnum(CalendarScopeType)
  scopeType?: CalendarScopeType;

  @IsOptional()
  @IsEnum(CalendarDayType)
  dayType?: CalendarDayType;

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
}
