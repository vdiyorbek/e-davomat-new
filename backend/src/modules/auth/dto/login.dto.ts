import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._]{3,50}$/, {
    message: 'Login formati noto‘g‘ri',
  })
  login!: string;

  @IsString()
  @Length(12, 128, {
    message: 'Parol uzunligi 12–128 belgi bo‘lishi kerak',
  })
  password!: string;
}
