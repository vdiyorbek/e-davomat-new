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

export class GetCalendarDayStatusDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  @IsEnum(MembershipType)
  membershipType!: MembershipType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId?: number;
}
