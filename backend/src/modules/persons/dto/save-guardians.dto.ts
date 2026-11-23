import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

function trimOrNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export class GuardianInputDto {
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100, { message: 'Familiya 1–100 belgidan iborat bo‘lsin' })
  lastName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100, { message: 'Ism 1–100 belgidan iborat bo‘lsin' })
  firstName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100, { message: 'Otasining ismi 1–100 belgidan iborat bo‘lsin' })
  middleName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/, {
    message: 'Telefon xalqaro formatda bo‘lsin: +998901234567',
  })
  phoneNumber?: string | null;
}

/**
 * undefined — tegilmaydi; null yoki bo‘sh obyekt — o‘chiriladi; to‘ldirilgan — saqlanadi.
 */
export class SaveGuardiansDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianInputDto)
  father?: GuardianInputDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianInputDto)
  mother?: GuardianInputDto | null;
}
