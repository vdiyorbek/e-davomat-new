import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._]{3,50}$/, {
    message: "Login 3-50 belgidan iborat bo'lishi kerak",
  })
  login?: string;

  @IsOptional()
  @IsString()
  @Length(12, 128, {
    message: "Parol uzunligi 12-128 belgi bo'lishi kerak",
  })
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
