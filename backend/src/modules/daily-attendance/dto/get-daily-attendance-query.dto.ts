import { Transform, Type } from 'class-transformer';

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AttendanceStatusFilter {
  INSIDE = 'inside',
  LEFT = 'left',
  EXCUSED = 'excused',
  ABSENT = 'absent',
  ANOMALY = 'anomaly',
}

export class GetDailyAttendanceQueryDto {
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(AttendanceStatusFilter)
  attendanceStatus?: AttendanceStatusFilter;

  @IsOptional()
  @Matches(/^\d{14}$/, {
    message: 'PNFL 14 ta raqamdan iborat bo‘lishi kerak',
  })
  pnfl?: string;
}
