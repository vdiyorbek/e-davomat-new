import { IsDateString, IsInt, Matches, Max, Min } from 'class-validator';

export class RebuildDailyAttendanceDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/, {
    message: 'date YYYY-MM-DD formatida, 2000–2099 oralig‘ida bo‘lishi kerak',
  })
  @IsDateString({ strict: true })
  date!: string;
}
