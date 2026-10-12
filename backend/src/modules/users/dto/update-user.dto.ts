import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string | null;

  @IsOptional()
  @IsUUID()
  districtId?: string | null;

  @IsOptional()
  @IsUUID()
  schoolId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
