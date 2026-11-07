import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { TalkResult, TalkSpokeWith } from '../inspector-talk.entity';

/** Barcha maydonlar ixtiyoriy. note va followUpDate uchun null yuborilsa, tozalanadi. */
export class UpdateInspectorTalkDto {
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  talkDate?: string;

  @IsOptional()
  @IsEnum(TalkSpokeWith)
  spokeWith?: TalkSpokeWith;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsEnum(TalkResult)
  result?: TalkResult;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  followUpDate?: string | null;
}
