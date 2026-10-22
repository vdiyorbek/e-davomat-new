import { IsDateString, Matches } from 'class-validator';

export class CancelLessonScheduleDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveDate!: string;
}
