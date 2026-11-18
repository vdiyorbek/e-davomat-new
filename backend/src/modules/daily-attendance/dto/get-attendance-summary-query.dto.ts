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

/** Hududlar kesimidagi davomat: davr va hudud filtrlari. */
export class GetAttendanceSummaryQueryDto {
  @IsOptional()
  @IsEnum(MembershipType, {
    message: 'membershipType STUDENT yoki TEACHER bo‘lishi kerak',
  })
  membershipType: MembershipType = MembershipType.STUDENT;

  /** Davr boshi (YYYY-MM-DD). Berilmasa — bugun. */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  /** Davr oxiri (YYYY-MM-DD). Berilmasa — `from` yoki bugun. */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  regionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  districtId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId?: number;
}
