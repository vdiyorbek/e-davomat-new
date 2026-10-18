import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ListTeacherAssignmentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @Matches(/^\d{4}-\d{4}$/)
  academicYear!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  teacherMembershipId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  subjectId?: number;
}
