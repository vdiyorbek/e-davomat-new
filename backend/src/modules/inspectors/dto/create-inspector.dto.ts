import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { CreateUserDto } from '../../users/dto/create-user.dto';

/** Uchastkavoy hisobi va unga biriktiriladigan mahallalar — bir so'rovda. */
export class CreateInspectorDto extends CreateUserDto {
  /** Tuman admini uchun e'tiborga olinmaydi (o'z tumani olinadi). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  districtId?: number;

  @IsArray()
  @ArrayMaxSize(30)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  mahallaIds!: number[];
}

export class GetInspectorsQueryDto {
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
  districtId?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  search?: string;
}
