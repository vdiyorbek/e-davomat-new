import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SchoolShiftTimeDto {
  @Type(() => Number)
  @IsIn([1, 2], { message: 'Smena 1 yoki 2 bo‘lishi kerak' })
  code!: 1 | 2;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Length(1, 100)
  name!: string;

  @Matches(TIME, { message: 'Boshlanish vaqti HH:MM formatida bo‘lishi kerak' })
  startTime!: string;

  @Matches(TIME, { message: 'Tugash vaqti HH:MM formatida bo‘lishi kerak' })
  endTime!: string;
}

export class UpsertSchoolShiftsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SchoolShiftTimeDto)
  shifts!: SchoolShiftTimeDto[];
}
