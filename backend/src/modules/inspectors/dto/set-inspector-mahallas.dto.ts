import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

import { MAX_MAHALLAS_PER_INSPECTOR } from '../inspector.rules';

export class SetInspectorMahallasDto {
  @IsArray()
  @ArrayMaxSize(MAX_MAHALLAS_PER_INSPECTOR)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  mahallaIds!: number[];
}
