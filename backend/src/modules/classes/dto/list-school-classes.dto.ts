import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class ListSchoolClassesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsString()
  @Matches(/^[1-9][0-9]{3}-[1-9][0-9]{3}$/, {
    message: 'O‘quv yili 2026-2027 formatida bo‘lishi kerak',
  })
  academicYear!: string;
}
