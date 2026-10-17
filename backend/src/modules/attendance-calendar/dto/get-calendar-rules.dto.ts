import { Type } from 'class-transformer';
import { IsDateString, IsInt, Matches, Max, Min } from 'class-validator';

export class GetCalendarRulesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;
}
