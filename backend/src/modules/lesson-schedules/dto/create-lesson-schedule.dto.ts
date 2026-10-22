import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateLessonScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherAssignmentId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  dayOfWeek!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  lessonNumber!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate?: string | null;
}
