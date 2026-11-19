import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class UpdateWeeklyHoursDto {
  /** null — rejadagi soat olib tashlanadi. */
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(40)
  weeklyHours!: number | null;
}
