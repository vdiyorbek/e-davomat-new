import { Type } from 'class-transformer';
import { IsDateString, IsInt, Matches, Min } from 'class-validator';

export class ListLessonSessionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
}
