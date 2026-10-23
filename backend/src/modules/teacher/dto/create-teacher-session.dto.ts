import { IsInt, Matches, Min } from 'class-validator';

export class CreateTeacherSessionDto {
  @IsInt()
  @Min(1)
  lessonScheduleId!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  lessonDate!: string;
}
