import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateMahallaDto {
  @IsInt({ message: "Tuman IDsi butun son bo'lishi kerak" })
  @Min(1, { message: "Tuman IDsi 1dan kichik bo'lganligi kerak" })
  districtId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'Mahalla nomi matn bo‘lishi kerak' })
  @IsNotEmpty({ message: 'Mahalla nomini kiriting' })
  @MaxLength(150, {
    message: 'Mahalla nomi 150 belgidan oshmasligi kerak',
  })
  name!: string;
}
