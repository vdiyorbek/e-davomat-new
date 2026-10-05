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
} from 'class-validator';
import { PersonGender } from '../person.entity';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePersonDto {
  @Transform(trimString)
  @IsString()
  @Matches(/^[0-9]{14}$/, {
    message: 'PNFL aynan 14 ta raqamdan iborat bo‘lishi kerak',
  })
  pnfl!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Ism 1–100 belgidan iborat bo‘lishi kerak',
  })
  firstName!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 100, {
    message: 'Familiya 1–100 belgidan iborat bo‘lishi kerak',
  })
  lastName!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  middleName?: string | null;

  @IsOptional()
  @IsEnum(PersonGender, {
    message: 'gender MALE yoki FEMALE bo‘lishi kerak',
  })
  gender?: PersonGender | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  nationality?: string | null;

  @IsOptional()
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, {
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
  @Length(1, 500)
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
