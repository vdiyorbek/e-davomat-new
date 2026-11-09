import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { MembershipType } from '../../school-memberships/school-membership.entity';

export class GetMissingPersonsQueryDto {
  @IsOptional()
  @IsEnum(MembershipType)
  type?: MembershipType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
