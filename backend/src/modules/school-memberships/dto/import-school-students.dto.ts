import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ImportSchoolStudentsDto {
  /** Maktab admini uchun kerak emas (o'z maktabi olinadi). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId?: number;

  /** Faqat "true" bo'lsa haqiqiy import; aks holda faqat tekshiriladi. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  apply?: boolean;
}
