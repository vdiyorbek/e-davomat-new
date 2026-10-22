import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ListLessonSchedulesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId!: number;

  @Matches(/^\d{4}-\d{4}$/)
  academicYear!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  // Muayyan sanada amal qilgan dars jadvali
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
}
