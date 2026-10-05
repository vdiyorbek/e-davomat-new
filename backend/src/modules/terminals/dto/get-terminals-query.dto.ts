import { Type } from 'class-transformer';

import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

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
  @IsEnum(TerminalDirection)
  direction?: TerminalDirection;
}
