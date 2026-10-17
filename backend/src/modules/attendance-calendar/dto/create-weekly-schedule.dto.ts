import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { MembershipType } from '../../school-memberships/school-membership.entity';

export class CreateWeeklyScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId!: number;

  @Matches(/^\d{4}-\d{4}$/)
  academicYear!: string;

  @IsEnum(MembershipType)
  membershipType!: MembershipType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(127)
  workingDaysMask!: number;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveTo?: string;
}
