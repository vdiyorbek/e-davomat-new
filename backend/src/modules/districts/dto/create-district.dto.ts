import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateDistrictDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Tuman yoki shahar nomi matn bo‘lishi kerak',
  })
  @Length(2, 150, {
    message: 'Nom 2–150 belgidan iborat bo‘lishi kerak',
  })
  name!: string;

  @IsInt({
    message: 'regionId butun son bo‘lishi kerak',
  })
  @Min(1, {
    message: 'regionId kamida 1 bo‘lishi kerak',
  })
  @Max(4294967295, {
    message: 'regionId ruxsat etilgan chegaradan katta',
  })
  regionId!: number;
}
