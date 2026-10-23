import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertStudentDetailDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  admissionOrderNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  educationLanguage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  educationForm?: string | null;
}
