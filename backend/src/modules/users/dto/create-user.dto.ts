import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateUserDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._]{3,50}$/, {
    message:
      "Login 3-50 belgili bo'lsin: lotin harflari, raqam, nuqta yoki pastki chiziq",
  })
  login!: string;

  @IsString()
  @Length(12, 128, {
    message: "Parol uzunligi 12-128 belgi bo'lishi kerak",
  })
  password!: string;
}
