import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @IsString()
  @Length(12, 128, {
    message: 'Yangi parol uzunligi 12–128 belgi bo‘lishi kerak',
  })
  newPassword!: string;
}
