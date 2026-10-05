import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetSchoolsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'regionId butun son bo‘lishi kerak',
  })
  @Min(1, {
    message: 'regionId kamida 1 bo‘lishi kerak',
  })
  @Max(4294967295, {
    message: 'regionId ruxsat etilgan chegaradan katta',
  })
  regionId?: number;

  @IsOptional()
  @Type(() => Number)
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
