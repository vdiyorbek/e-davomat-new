import { Transform } from 'class-transformer';

import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateMemberAccountDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  membershipId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._]{3,50}$/, {
    message:
      'Login 3-50 ta kichik lotin harfi, raqam, nuqta yoki pastki chiziqdan iborat bo‘lishi kerak',
  })
  login!: string;

  @IsString()
  @Length(12, 128, {
    message: 'Parol uzunligi 12-128 belgi bo‘lishi kerak',
  })
  password!: string;
}
