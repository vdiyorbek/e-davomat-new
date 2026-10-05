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

function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateTerminalDto {
  @Transform(trimText)
  @IsString()
  @Length(2, 150)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsEnum(TerminalDirection, {
    message: 'direction IN yoki OUT bo‘lishi kerak',
  })
  direction!: TerminalDirection;

  @IsEnum(TerminalProtocol, {
    message: 'protocol HTTP yoki HTTPS bo‘lishi kerak',
  })
  protocol!: TerminalProtocol;

  @Transform(trimText)
  @IsIP(undefined, {
    message: 'host haqiqiy IPv4 yoki IPv6 manzil bo‘lishi kerak',
  })
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @Transform(trimText)
  @IsString()
  @Length(1, 100)
  username!: string;

  // Parolni trim qilmaymiz: bo‘sh joy uning bir qismi bo‘lishi mumkin.
  @IsString()
  @Length(1, 256)
  password!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
