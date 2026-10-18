import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateTeacherAssignmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  teacherMembershipId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  subjectId!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate?: string | null;
}
