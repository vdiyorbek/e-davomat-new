import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateRegionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Viloyat nomi matn bo‘lishi kerak' })
  @Length(2, 150, {
    message: 'Viloyat nomi 2–150 belgidan iborat bo‘lishi kerak',
  })
  name!: string;
}
