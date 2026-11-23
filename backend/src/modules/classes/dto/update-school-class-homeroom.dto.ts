import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateSchoolClassHomeroomDto {
  /** Sinf rahbari o‘qituvchi shaxsi; null — rahbarni olib tashlash. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number | null;
}
