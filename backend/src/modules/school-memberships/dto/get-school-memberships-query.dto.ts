import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { MembershipType } from '../school-membership.entity';
import { MembershipStatus } from '../enums/membership-status.enum';

export class GetSchoolMembershipsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId?: number;

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
  @IsEnum(MembershipType)
  type?: MembershipType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MaxLength(100, {
    message: 'Qidiruv matni 100 ta belgidan oshmasligi kerak',
  })
  q?: string;

  @IsOptional()
  @IsEnum(MembershipStatus, {
    message: 'status ACTIVE, ENDED yoki PLANNED bo‘lishi kerak',
  })
  status?: MembershipStatus;
}
