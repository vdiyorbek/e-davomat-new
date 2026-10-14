import { Type } from 'class-transformer';
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
} from 'class-validator';

import { AttendanceExcuseReason } from '../attendance-excuse.entity';

export class CreateAttendanceExcuseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsEnum(AttendanceExcuseReason)
  reason!: AttendanceExcuseReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonNote?: string;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;
}
