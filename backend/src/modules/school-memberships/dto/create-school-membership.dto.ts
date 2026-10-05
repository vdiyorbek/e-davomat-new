import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { MembershipType } from '../school-membership.entity';

export class CreateSchoolMembershipDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsEnum(MembershipType, {
    message: 'type STUDENT yoki TEACHER bo‘lishi kerak',
  })
  type!: MembershipType;

  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'startDate YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsDateString(
    { strict: true },
    { message: 'startDate haqiqiy sana bo‘lishi kerak' },
  )
  startDate!: string;

  @IsOptional()
  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'endDate YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsDateString(
    { strict: true },
    { message: 'endDate haqiqiy sana bo‘lishi kerak' },
  )
  endDate?: string | null;
}
