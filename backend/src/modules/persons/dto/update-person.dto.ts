import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { PersonGender } from '../person.entity';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdatePersonDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Ism 1–100 belgidan iborat bo‘lishi kerak',
  })
  firstName?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Familiya 1–100 belgidan iborat bo‘lishi kerak',
  })
  lastName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Otasining ismi 1–100 belgidan iborat bo‘lishi kerak',
  })
  middleName?: string | null;

  @IsOptional()
  @IsEnum(PersonGender, {
    message: 'Jinsi MALE yoki FEMALE bo‘lishi kerak',
  })
  gender?: PersonGender | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Millati 1–100 belgidan iborat bo‘lishi kerak',
  })
  nationality?: string | null;

  @IsOptional()
  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'Tug‘ilgan sana YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsDateString(
    { strict: true },
    { message: 'Tug‘ilgan sana haqiqiy sana bo‘lishi kerak' },
  )
  birthDate?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 500, {
    message: 'Yashash manzili 1–500 belgidan iborat bo‘lishi kerak',
  })
  address?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/, {
    message: 'Telefon xalqaro formatda bo‘lsin: +998901234567',
  })
  phoneNumber?: string | null;

  @IsOptional()
  @IsInt({ message: 'Mahalla IDsi butun son bo‘lishi kerak' })
  @Min(1)
  @Max(4294967295)
  mahallaId?: number | null;
}
