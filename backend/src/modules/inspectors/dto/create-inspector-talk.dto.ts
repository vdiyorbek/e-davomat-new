import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { TalkResult, TalkSpokeWith } from '../inspector-talk.entity';

export class CreateInspectorTalkDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;

  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  talkDate!: string;

  @IsEnum(TalkSpokeWith)
  spokeWith!: TalkSpokeWith;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;

  @IsEnum(TalkResult)
  result!: TalkResult;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  followUpDate?: string;
}
