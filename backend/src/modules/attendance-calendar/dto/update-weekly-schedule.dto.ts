import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateWeeklyScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(127)
  workingDaysMask!: number;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveFrom?: string;
}
