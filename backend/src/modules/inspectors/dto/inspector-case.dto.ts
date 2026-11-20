import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CaseContact, CaseOutcome, CaseReason } from '../inspector-case.entity';

const DATE = /^20\d{2}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class OpenInspectorCaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;
}

/** O'rganish natijalari: ochiq ishni to'ldirish va yopish uchun bir xil maydonlar. */
export class UpdateInspectorCaseDto {
  @IsOptional()
  @Matches(DATE)
  @IsDateString({ strict: true })
  visitDate?: string;

  @IsOptional()
  @IsEnum(CaseContact)
  spokeWith?: CaseContact;

  @IsOptional()
  @IsEnum(CaseReason)
  reason?: CaseReason;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  findings?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  actionsTaken?: string;

  @IsOptional()
  @IsEnum(CaseOutcome)
  outcome?: CaseOutcome;

  @IsOptional()
  @Matches(DATE)
  @IsDateString({ strict: true })
  followUpDate?: string;
}

export class GetInspectorAbsenteesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mahallaId?: number;

  /** NEW — hali o'rganilmagan; IN_PROGRESS — ochiq ish bor. */
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS'])
  state?: 'NEW' | 'IN_PROGRESS';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
}

export class GetInspectorCasesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personId?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
}
