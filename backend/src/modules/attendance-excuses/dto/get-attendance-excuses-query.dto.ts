import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { AttendanceExcuseStatus } from '../attendance-excuse.entity';
import { MembershipType } from '../../school-memberships/school-membership.entity';

export class GetAttendanceExcusesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personId?: number;

  @IsOptional()
  @IsEnum(AttendanceExcuseStatus)
  status?: AttendanceExcuseStatus;

  /** O‘quvchilar yoki o‘qituvchilar arizalari. */
  @IsOptional()
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  /** F.I.Sh. yoki PNFL bo‘yicha qidiruv. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q?: string;

  /** Shu oraliq bilan kesishgan arizalar. */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;
}
