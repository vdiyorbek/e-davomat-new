import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

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
}
