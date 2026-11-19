import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class AssignClassShiftDto {
  @Type(() => Number)
  @IsIn([1, 2], { message: 'Smena 1 yoki 2 bo‘lishi kerak' })
  shiftCode!: 1 | 2;

  /** Bo‘sh bo‘lsa — bugundan. */
  @IsOptional()
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'Sana YYYY-MM-DD formatida bo‘lishi kerak' },
  )
  startDate?: string;
}

export class AssignClassShiftsDto extends AssignClassShiftDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta sinf tanlang' })
  @ArrayMaxSize(500, {
    message: 'Bir vaqtda 500 tadan ko‘p sinf tanlab bo‘lmaydi',
  })
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4294967295, { each: true })
  classIds!: number[];
}
