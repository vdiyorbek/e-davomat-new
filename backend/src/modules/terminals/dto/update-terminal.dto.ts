import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { TerminalDirection } from '../enums/terminal-direction.enum';
import { TerminalProtocol } from '../enums/terminal-protocol.enum';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateTerminalDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsEnum(TerminalDirection)
  direction?: TerminalDirection;

  @IsOptional()
  @IsEnum(TerminalProtocol)
  protocol?: TerminalProtocol;

  @IsOptional()
  @Transform(trimText)
  @IsIP()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 100)
  username?: string;

  // Paroldagi bo'sh joylarni o'zgartirmaymiz.
  // Parol yuborilmasa, eskisi saqlanadi.
  @IsOptional()
  @IsString()
  @Length(1, 256)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
