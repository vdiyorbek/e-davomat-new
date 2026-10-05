import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';

export class UpdateSchoolDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Maktab nomi matn bo‘lishi kerak',
  })
  @Length(2, 200, {
    message: 'Maktab nomi 2–200 belgidan iborat bo‘lishi kerak',
  })
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt({
    message: 'districtId butun son bo‘lishi kerak',
  })
  @Min(1, {
    message: 'districtId kamida 1 bo‘lishi kerak',
  })
  @Max(4294967295, {
    message: 'districtId ruxsat etilgan chegaradan katta',
  })
  districtId?: number;
}
