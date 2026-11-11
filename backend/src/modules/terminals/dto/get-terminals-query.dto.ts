import { Type } from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsDateString,
  Matches,
  IsString,
  MaxLength,
} from 'class-validator';

import { TerminalDirection } from '../enums/terminal-direction.enum';

export class GetTerminalsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  districtId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  regionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(TerminalDirection)
  direction?: TerminalDirection;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'ARCHIVED', 'ALL'])
  archiveStatus?: 'ACTIVE' | 'ARCHIVED' | 'ALL';

  /** Ulanish holati bo‘yicha filtr (KPI kartasi bosilganda). */
  @IsOptional()
  @IsEnum(['ONLINE', 'OFFLINE', 'UNKNOWN'])
  healthStatus?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

  /** Faqat sinxronlashi kechikayotgan terminallar. */
  @IsOptional()
  @IsEnum(['DELAYED'])
  syncStatus?: 'DELAYED';
}
