import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hudud doirasi: berilmasa — foydalanuvchining o‘z doirasi. */
export class DashboardScopeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;
}

export class DashboardDayDto extends DashboardScopeDto {
  @IsOptional()
  @Matches(DATE)
  @IsDateString({ strict: true })
  date?: string;
}

export class DashboardTrendDto extends DashboardScopeDto {
  @IsOptional()
  @Matches(DATE)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(DATE)
  @IsDateString({ strict: true })
  to?: string;
}

export class DashboardStreaksDto extends DashboardDayDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class BackfillStatsDto {
  @Matches(DATE)
  @IsDateString({ strict: true })
  from!: string;

  @Matches(DATE)
  @IsDateString({ strict: true })
  to!: string;
}

export class UpdateGeoKeyDto {
  @IsIn(['REGION', 'DISTRICT'])
  level!: 'REGION' | 'DISTRICT';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

  /** null — bog‘lanishni olib tashlash. */
  @IsOptional()
  @Matches(/^UZ-[A-Z]{2}(-[a-z0-9_-]{1,60})?$/)
  geoKey?: string | null;
}

export class UpdateLateThresholdDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  lateThresholdMinutes!: number;
}
