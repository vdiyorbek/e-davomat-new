import { IsInt, Max, Min } from 'class-validator';

export class UpdateSchoolClassGradeDto {
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;
}
