import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserAccessDto {
  @IsIn(
    [
      UserRole.USER,
      UserRole.REGION_ADMIN,
      UserRole.DISTRICT_ADMIN,
      UserRole.SCHOOL_ADMIN,
    ],
    {
      message: 'Ruxsat etilgan boshqaruv rolini tanlang',
    },
  )
  role!: UserRole;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  regionId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  districtId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId?: number | null;
}
