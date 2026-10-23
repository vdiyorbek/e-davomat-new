import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTeacherDetailDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employmentType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  qualificationCategory?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  specialization?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  educationLevel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  hireOrderNumber?: string | null;
}
